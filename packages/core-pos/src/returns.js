// Part returns for a saved bill (C-02). Pure: no database, no clock. Whole rupees; the bill's currency travels with it.
// Rule: the refund for a line is proportional to the quantity returned, using cumulative rounding so that
// returning a line in several steps always adds up to exactly the line total (no lost or extra rupee).
// Points, pay-later and points-paid rupees are reversed in the same cumulative way, by the share of the bill refunded.
// ASSUMPTION (Tier 2, AUTO-DEFAULT): a refund first cancels unpaid pay-later (udhaar) on that bill, then points-paid rupees
// go back as points, and only the rest is handed back as money.
const bad = (m) => { const e = new Error(m); e.code = 'BILL_INVALID'; throw e; };
const q3 = (n) => Math.round(Number(n) * 1000) / 1000;
const cum = (amount, num, den) => (den > 0 ? Math.round((amount * num) / den) : 0);

// bill: { lines: [{ name, itemId?, qty, total }], total, credit?, pointsEarned?, pointsUsed?, payments?: [{method, amount}] }
// items: [{ lineIndex, qty }]   returnedQty: number[] (quantity already returned per line; missing = 0)
const plan = ({ bill, items, returnedQty = [] }) => {
  if (!bill || !Array.isArray(bill.lines) || !bill.lines.length) bad('Bill not found.');
  if (!Array.isArray(items) || !items.length) bad('Choose at least one line to return.');
  const asked = new Map();
  for (const it of items) {
    const i = it && Number.isInteger(it.lineIndex) ? it.lineIndex : -1;
    const qty = q3(it && it.qty);
    if (i < 0 || i >= bill.lines.length) bad('A line to return is not on this bill.');
    if (!Number.isFinite(qty) || qty <= 0) bad('Return quantity must be more than zero.');
    asked.set(i, q3((asked.get(i) || 0) + qty));
  }
  const prior = bill.lines.map((_, i) => q3(returnedQty[i] || 0));
  const next = prior.slice();
  const lines = [];
  let refund = 0; let priorRefund = 0; let newRefund = 0;
  bill.lines.forEach((l, i) => {
    const lineQty = Number(l.qty); const lineTotal = Math.round(Number(l.total) || 0);
    priorRefund += cum(lineTotal, prior[i], lineQty);
    const now = asked.get(i) || 0;
    if (now > 0) {
      if (prior[i] + now > lineQty + 1e-9) bad(`Only ${q3(lineQty - prior[i])} of "${l.name || 'this line'}" is left to return.`);
      next[i] = q3(prior[i] + now);
      const r = cum(lineTotal, next[i], lineQty) - cum(lineTotal, prior[i], lineQty);
      lines.push({ lineIndex: i, itemId: l.itemId || null, name: l.name, qty: now, refund: r });
      refund += r;
    }
    newRefund += cum(lineTotal, next[i], lineQty);
  });

  const total = Math.round(Number(bill.total) || 0);
  const share = (amount) => cum(amount, newRefund, total) - cum(amount, priorRefund, total);
  const creditCap = Math.max(0, Math.round(Number(bill.credit) || 0));
  const creditReduction = Math.min(creditCap, newRefund) - Math.min(creditCap, priorRefund);
  const loyaltyPaid = (bill.payments || []).filter((p) => p.method === 'loyalty').reduce((a, p) => a + Math.round(Number(p.amount) || 0), 0);
  const loyaltyBack = share(loyaltyPaid);
  const cashBack = Math.max(0, refund - creditReduction - loyaltyBack);
  const earnedReverse = share(Math.round(Number(bill.pointsEarned) || 0));
  const redeemedBack = share(Math.round(Number(bill.pointsUsed) || 0));

  return {
    lines, refund, creditReduction, loyaltyBack, cashBack,
    stockBack: lines.filter((l) => l.itemId).map((l) => ({ itemId: l.itemId, qty: l.qty })),
    points: redeemedBack - earnedReverse, // ledger entry: negative = take points away
    returnedAmount: newRefund,
    nextReturnedQty: next,
    fullyReturned: bill.lines.every((l, i) => next[i] + 1e-9 >= Number(l.qty)),
  };
};

module.exports = { plan };
