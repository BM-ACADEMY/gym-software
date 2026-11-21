// Bill maths for every shop product. Whole rupees only; the currency code travels with every amount.
// Pure: no database, no clock, no network. GST rules (D-10 area): gst_inclusive = shelf price already contains GST,
// gst_exclusive = GST added on top, none = plain bill. Seller/buyer state decides cgst_sgst vs igst (caller passes gstMode).
const TAX_MODES = ['gst_inclusive', 'gst_exclusive', 'none'];
const GST_MODES = ['cgst_sgst', 'igst'];
const GST_SLABS = [0, 3, 5, 12, 18, 28]; // common Indian slabs; the owner picks per item

const int = (n) => Math.round(Number(n) || 0);
const bad = (m) => { const e = new Error(m); e.code = 'BILL_INVALID'; throw e; };

// Splits `total` across weights so the parts add up exactly (largest remainder).
const allocate = (total, weights) => {
  const sum = weights.reduce((a, b) => a + b, 0);
  if (total <= 0 || sum <= 0) return weights.map(() => 0);
  const raw = weights.map((w) => (total * w) / sum);
  const out = raw.map(Math.floor);
  let left = total - out.reduce((a, b) => a + b, 0);
  const order = raw.map((r, i) => [r - Math.floor(r), i]).sort((a, b) => b[0] - a[0]);
  for (const [, i] of order) { if (left <= 0) break; out[i] += 1; left -= 1; }
  return out;
};

// line: { name, unitPrice, qty, discount?: { type: 'percent'|'amount', value }, gstRate?, staffId?, kind? }
const compute = ({ lines, billDiscount, taxMode = 'none', gstMode = 'cgst_sgst', currency = 'INR' }) => {
  if (!Array.isArray(lines) || !lines.length) bad('A bill needs at least one line.');
  if (!TAX_MODES.includes(taxMode)) bad('Unknown tax mode.');
  if (!GST_MODES.includes(gstMode)) bad('Unknown GST mode.');

  // 1. line gross and line discount
  const rows = lines.map((l) => {
    const unitPrice = int(l.unitPrice); const qty = Number(l.qty);
    if (unitPrice < 0 || !Number.isFinite(qty) || qty <= 0) bad(`Line "${l.name || ''}" has a wrong price or quantity.`);
    const gross = int(unitPrice * qty);
    let d = 0;
    if (l.discount) {
      const v = Number(l.discount.value) || 0;
      if (l.discount.type === 'percent') { if (v < 0 || v > 100) bad('Discount percent must be 0 to 100.'); d = int((gross * v) / 100); }
      else if (l.discount.type === 'amount') { if (v < 0) bad('Discount cannot be negative.'); d = int(v); }
      else bad('Unknown discount type.');
    }
    d = Math.min(d, gross);
    const rate = taxMode === 'none' ? 0 : Number(l.gstRate ?? 0);
    if (!GST_SLABS.includes(rate)) bad(`GST rate ${rate} is not a standard slab.`);
    return { name: l.name, kind: l.kind || 'item', staffId: l.staffId || null, itemId: l.itemId || null, qty, unitPrice, gross, lineDiscount: d, net: gross - d, rate };
  });

  // 2. bill-level discount shared across lines in proportion to what each line costs
  const netSum = rows.reduce((a, r) => a + r.net, 0);
  let bd = 0;
  if (billDiscount) {
    const v = Number(billDiscount.value) || 0;
    if (billDiscount.type === 'percent') { if (v < 0 || v > 100) bad('Discount percent must be 0 to 100.'); bd = int((netSum * v) / 100); }
    else if (billDiscount.type === 'amount') { if (v < 0) bad('Discount cannot be negative.'); bd = int(v); }
    else bad('Unknown discount type.');
    bd = Math.min(bd, netSum);
  }
  const share = allocate(bd, rows.map((r) => r.net));

  // 3. tax per line
  let subtotal = 0; let taxable = 0; let gst = 0; let discount = 0;
  const out = rows.map((r, i) => {
    const payable = r.net - share[i]; // what the customer pays for this line before any added GST
    let lineTaxable; let lineGst; let lineTotal;
    if (taxMode === 'gst_inclusive') { lineTaxable = int((payable * 100) / (100 + r.rate)); lineGst = payable - lineTaxable; lineTotal = payable; }
    else if (taxMode === 'gst_exclusive') { lineTaxable = payable; lineGst = int((payable * r.rate) / 100); lineTotal = payable + lineGst; }
    else { lineTaxable = payable; lineGst = 0; lineTotal = payable; }
    subtotal += r.gross; discount += r.lineDiscount + share[i]; taxable += lineTaxable; gst += lineGst;
    return { ...r, billDiscountShare: share[i], taxable: lineTaxable, gst: lineGst, total: lineTotal };
  });

  const total = out.reduce((a, r) => a + r.total, 0);
  let cgst = 0; let sgst = 0; let igst = 0;
  if (gst > 0) { if (gstMode === 'igst') igst = gst; else { cgst = Math.round(gst / 2); sgst = gst - cgst; } }
  return { lines: out, subtotal, discount, taxable, gst, cgst, sgst, igst, total, taxMode, gstMode, currency };
};

const METHODS = ['cash', 'upi', 'card', 'wallet', 'loyalty', 'giftcard', 'credit']; // credit = pay later (udhaar)

// payments: [{ method, amount }]. Only cash can be handed over in excess; the extra comes back as change.
const settle = (total, payments = []) => {
  let paid = 0; let cash = 0; let nonCash = 0;
  for (const p of payments) {
    if (!METHODS.includes(p.method)) bad(`Unknown payment method "${p.method}".`);
    const a = int(p.amount);
    if (a < 0) bad('A payment cannot be negative.');
    if (p.method === 'cash') cash += a; else if (p.method !== 'credit') nonCash += a;
    if (p.method !== 'credit') paid += a;
  }
  const credit = payments.filter((p) => p.method === 'credit').reduce((a, p) => a + int(p.amount), 0);
  if (nonCash > total) bad('Card, UPI, wallet, points and gift card payments cannot be more than the bill.');
  const change = Math.max(0, paid - total);
  if (change > cash) bad('Change can only be given back from cash.');
  const received = paid - change;
  const due = Math.max(0, total - received - credit);
  const status = received >= total ? 'paid' : credit > 0 && received + credit >= total ? 'credit' : received > 0 ? 'partial' : 'unpaid';
  return { received, change, credit, due, status };
};

module.exports = { compute, settle, allocate, TAX_MODES, GST_MODES, GST_SLABS, METHODS };
