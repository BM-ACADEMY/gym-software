'use strict';
// Suggestions for the owner. Every suggestion carries a plain-language `reason` built from the owner's own numbers, so it can be
// trusted or rejected (docs/PRODUCT_PRINCIPLES.md section 4). Thresholds are Assumptions the owner can change.
const med = (a) => { const s = [...a].sort((x, y) => x - y); const n = s.length; return n ? (n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2) : 0; };

// Menu engineering. items: [{ key, name, qty, revenue, cost }] cost = analysis cost of all units sold (may be null if no recipe).
// popular = sold at least 70 percent of the average item's quantity; rich = margin per unit at least the average. Classic four boxes.
function bestWorst(items) {
  const rows = items.filter((i) => i.qty > 0);
  if (!rows.length) return [];
  const avgQty = rows.reduce((a, i) => a + i.qty, 0) / rows.length;
  const withCost = rows.filter((i) => i.cost !== null && i.cost !== undefined);
  const margins = withCost.map((i) => (i.revenue - i.cost) / i.qty);
  const avgMargin = margins.length ? margins.reduce((a, b) => a + b, 0) / margins.length : null;
  return rows.map((i) => {
    const popular = i.qty >= 0.7 * avgQty;
    if (avgMargin === null || i.cost === null || i.cost === undefined) return { key: i.key, name: i.name, verdict: 'no_cost', reason: i.name + ': add its recipe to see if it makes money. Sold ' + i.qty + ' times.' };
    const m = (i.revenue - i.cost) / i.qty; const rich = m >= avgMargin;
    const m0 = Math.round(m);
    if (popular && rich) return { key: i.key, name: i.name, verdict: 'keep', reason: i.name + ' sells well (' + i.qty + ') and earns about Rs ' + m0 + ' a plate. Keep it up front.' };
    if (popular && !rich) return { key: i.key, name: i.name, verdict: 'reprice', reason: i.name + ' sells well (' + i.qty + ') but earns only about Rs ' + m0 + ' a plate, below your Rs ' + Math.round(avgMargin) + ' average. A small price rise may pay off.' };
    if (!popular && rich) return { key: i.key, name: i.name, verdict: 'promote', reason: i.name + ' earns about Rs ' + m0 + ' a plate but sold only ' + i.qty + '. Tell the staff to suggest it.' };
    return { key: i.key, name: i.name, verdict: 'drop', reason: i.name + ' sold only ' + i.qty + ' and earns about Rs ' + m0 + ' a plate. It is taking space on the menu and in the kitchen.' };
  });
}
// Slow hours. byHour: [{ hour: 0..23, sales }] for the days being looked at (several days summed or averaged by the caller).
// Among hours the place was open (sales > 0 on at least one hour with data), slow = under 50 percent of the median open hour.
function slowHours(byHour, share = 0.5) {
  const open = byHour.filter((h) => h.open !== false);
  const m = med(open.map((h) => h.sales));
  if (m <= 0) return [];
  return open.filter((h) => h.sales < m * share).map((h) => ({ hour: h.hour, sales: h.sales, reason: 'Between ' + h.hour + ':00 and ' + (h.hour + 1) + ':00 you sold Rs ' + h.sales + ', under half of a normal hour (Rs ' + Math.round(m) + ').' }));
}
// Leakage flags for one day. d = { bills: n, voidsAfterSend, discountTotal, grossSales, cashExpected, cashCounted, reopens, billsEdited }
// Thresholds (Assumption): voids >= 3 or >= 5 percent of bills; discounts >= 10 percent of sales; cash short by Rs 100 or more; reopens >= 3.
function leakageFlags(d) {
  const out = [];
  if (d.voidsAfterSend >= 3 || (d.bills > 0 && (d.voidsAfterSend / d.bills) * 100 >= 5)) out.push({ code: 'voids', reason: d.voidsAfterSend + ' items were voided after they went to the kitchen or bar, out of ' + d.bills + ' bills. Check who and why.' });
  if (d.grossSales > 0 && (d.discountTotal / d.grossSales) * 100 >= 10) out.push({ code: 'discounts', reason: 'Discounts were Rs ' + d.discountTotal + ' on Rs ' + d.grossSales + ' of sales (' + Math.round((d.discountTotal / d.grossSales) * 100) + ' percent).' });
  if (Number.isFinite(d.cashExpected) && Number.isFinite(d.cashCounted) && d.cashExpected - d.cashCounted >= 100) out.push({ code: 'cash_short', reason: 'Cash in the drawer is Rs ' + (d.cashExpected - d.cashCounted) + ' less than the bills say.' });
  if (d.reopens >= 3) out.push({ code: 'reopens', reason: d.reopens + ' bills were reopened after printing. Check the reasons.' });
  return out;
}
module.exports = { bestWorst, slowHours, leakageFlags, med };
