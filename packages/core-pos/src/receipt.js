// Plain-text receipt for thermal printers (58 mm = 32 columns, 80 mm = 48 columns). Pure: no clock, no database, no printer code.
// ASCII only on purpose: most cheap thermal printers print Tamil/Hindi letters as "?" (same limit as the gym payslip PDF).
// The caller passes the saved bill, the shop details and the time as text. Rupee sign is written "Rs".
const WIDTHS = { 32: 32, 48: 48 };
const bad = (m) => { const e = new Error(m); e.code = 'RECEIPT_INVALID'; throw e; };

// Indian digit grouping: 1234567 -> 12,34,567. Whole rupees only (money rule).
const inr = (n) => {
  const v = Math.round(Number(n) || 0); const neg = v < 0; const s = String(Math.abs(v));
  let out = s;
  if (s.length > 3) { const last3 = s.slice(-3); let rest = s.slice(0, -3); const parts = []; while (rest.length > 2) { parts.unshift(rest.slice(-2)); rest = rest.slice(0, -2); } if (rest) parts.unshift(rest); out = `${parts.join(',')},${last3}`; }
  return `${neg ? '-' : ''}${out}`;
};
const ascii = (t) => String(t == null ? '' : t).replace(/[^\x20-\x7e]/g, '?').replace(/\s+/g, ' ').trim();

const wrap = (text, w) => {
  const words = ascii(text).split(' ').filter(Boolean); const rows = []; let cur = '';
  for (let word of words) {
    while (word.length > w) { if (cur) { rows.push(cur); cur = ''; } rows.push(word.slice(0, w)); word = word.slice(w); }
    if (!cur) cur = word; else if (cur.length + 1 + word.length <= w) cur += ` ${word}`; else { rows.push(cur); cur = word; }
  }
  if (cur) rows.push(cur);
  return rows;
};
const center = (t, w) => wrap(t, w).map((r) => ' '.repeat(Math.floor((w - r.length) / 2)) + r);
const pair = (left, right, w) => {
  const r = ascii(right); const room = w - r.length - 1;
  const l = wrap(left, Math.max(room, 1)); const rows = l.length ? l : [''];
  const last = rows.pop();
  return [...rows, last + ' '.repeat(Math.max(1, w - last.length - r.length)) + r];
};
const qtyText = (q) => (Number.isInteger(Number(q)) ? String(q) : String(Number(Number(q).toFixed(3))));

// bill: a saved PosBill-like object. shop: { name, address?, phone?, gstin?, footer? }. opts: { width: 32|48, at: 'text for date and time', cashier?, customerName?, pointsBalance? }
const render = (bill, shop = {}, opts = {}) => {
  const w = WIDTHS[opts.width || 32];
  if (!w) bad('Receipt width must be 32 or 48 columns.');
  if (!bill || !Array.isArray(bill.lines) || !bill.lines.length) bad('A receipt needs a bill with lines.');
  if (!shop.name) bad('A receipt needs the shop name.');
  const cur = bill.currency && bill.currency !== 'INR' ? `${ascii(bill.currency)} ` : 'Rs ';
  const money = (n) => `${cur}${inr(n)}`;
  const rule = '-'.repeat(w); const out = [];
  out.push(...center(shop.name, w));
  if (shop.address) out.push(...center(shop.address, w));
  if (shop.phone) out.push(...center(`Ph ${shop.phone}`, w));
  const taxed = bill.taxMode && bill.taxMode !== 'none';
  if (shop.gstin && taxed) out.push(...center(`GSTIN ${shop.gstin}`, w));
  out.push(rule);
  out.push(...pair(`Bill ${bill.number || ''}`, opts.at || '', w));
  if (opts.customerName) out.push(...wrap(`Customer ${opts.customerName}`, w));
  if (opts.cashier) out.push(...wrap(`Served by ${opts.cashier}`, w));
  out.push(rule);

  for (const l of bill.lines) {
    out.push(...pair(l.name || 'Item', money(l.total), w));
    const detail = `  ${qtyText(l.qty)} x ${money(l.unitPrice)}${taxed && l.rate ? ` GST ${l.rate}%` : ''}`;
    out.push(...wrap(detail, w).map((r, i) => (i === 0 ? detail.slice(0, w) : `  ${r}`)).slice(0, 1));
    const disc = (l.lineDiscount || 0) + (l.billDiscountShare || 0);
    if (disc > 0) out.push(...pair('  Discount', `-${money(disc)}`, w));
  }
  out.push(rule);
  if (bill.discount > 0) { out.push(...pair('Subtotal', money(bill.subtotal), w)); out.push(...pair('Discount', `-${money(bill.discount)}`, w)); }
  if (taxed) {
    out.push(...pair('Taxable value', money(bill.taxable), w));
    if (bill.cgst || bill.sgst) { out.push(...pair('CGST', money(bill.cgst), w)); out.push(...pair('SGST', money(bill.sgst), w)); }
    if (bill.igst) out.push(...pair('IGST', money(bill.igst), w));
    if (bill.taxMode === 'gst_inclusive') out.push(...wrap('Prices include GST.', w));
  }
  out.push(...pair('TOTAL', money(bill.total), w));
  out.push(rule);
  for (const p of bill.payments || []) {
    const name = ({ cash: 'Cash', upi: 'UPI', card: 'Card', wallet: 'Wallet', loyalty: 'Points', giftcard: 'Gift card', credit: 'Pay later' })[p.method] || ascii(p.method);
    out.push(...pair(name, money(p.amount), w));
  }
  if (bill.change > 0) out.push(...pair('Change', money(bill.change), w));
  if (bill.due > 0) out.push(...pair('BALANCE DUE', money(bill.due), w));
  if (bill.status === 'returned') out.push(...center('** RETURNED **', w));
  else if (bill.returnedAmount > 0) out.push(...pair('Returned so far', money(bill.returnedAmount), w));
  if (bill.pointsEarned > 0) out.push(...pair('Points earned', String(bill.pointsEarned), w));
  if (bill.pointsUsed > 0) out.push(...pair('Points used', String(bill.pointsUsed), w));
  if (opts.pointsBalance != null) out.push(...pair('Points balance', String(opts.pointsBalance), w));
  out.push(rule);
  out.push(...center(shop.footer || 'Thank you. Visit again.', w));
  return out.join('\n') + '\n';
};

module.exports = { render, inr, wrap };
