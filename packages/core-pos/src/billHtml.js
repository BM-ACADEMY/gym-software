// Printable A4/A5 bill as one self-contained HTML page (C-02, 2 Nov). Pure: no clock, no database, no printer code.
// Why HTML: a browser prints it to PDF on any phone or PC, and Tamil and Hindi letters print correctly (thermal text receipts cannot).
// Everything from the shop or the customer is escaped; nothing is loaded from outside; no script runs in the page.
// Money is whole rupees (Indian digit grouping). The caller passes the saved bill, shop details and the time as text.
const { inr } = require('./receipt');
const bad = (m) => { const e = new Error(m); e.code = 'BILL_HTML_INVALID'; throw e; };
const SIZES = { A4: '210mm', A5: '148mm' };
const esc = (t) => String(t == null ? '' : t).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const qtyText = (q) => (Number.isInteger(Number(q)) ? String(q) : String(Number(Number(q).toFixed(3))));
const PAY = { cash: 'Cash', upi: 'UPI', card: 'Card', wallet: 'Wallet', loyalty: 'Points', giftcard: 'Gift card', credit: 'Pay later' };

// bill: saved PosBill-like object. shop: { name, address?, phone?, gstin?, footer? }.
// opts: { size: 'A4'|'A5', at, cashier?, customerName?, customerPhone?, pointsBalance?, lang?: 'en'|'ta'|'hi' }
const render = (bill, shop = {}, opts = {}) => {
  const width = SIZES[opts.size || 'A5'];
  if (!width) bad('Bill size must be A4 or A5.');
  if (!bill || !Array.isArray(bill.lines) || !bill.lines.length) bad('A bill page needs a bill with lines.');
  if (!shop.name) bad('A bill page needs the shop name.');
  const cur = bill.currency && bill.currency !== 'INR' ? `${esc(bill.currency)} ` : 'Rs ';
  const m = (n) => `${cur}${inr(n)}`;
  const taxed = bill.taxMode && bill.taxMode !== 'none';
  const row = (a, b, cls = '') => `<tr class="${cls}"><td colspan="3">${a}</td><td class="r">${b}</td></tr>`;
  const lines = bill.lines.map((l, i) => {
    const disc = (l.lineDiscount || 0) + (l.billDiscountShare || 0);
    return `<tr><td>${i + 1}</td><td>${esc(l.name || 'Item')}${disc > 0 ? `<br><small>Discount -${m(disc)}</small>` : ''}</td>`
      + `<td class="r">${esc(qtyText(l.qty))} x ${m(l.unitPrice)}${taxed && l.rate ? `<br><small>GST ${esc(l.rate)}%</small>` : ''}</td><td class="r">${m(l.total)}</td></tr>`;
  }).join('');
  const sums = [];
  if (bill.discount > 0) { sums.push(row('Subtotal', m(bill.subtotal))); sums.push(row('Discount', `-${m(bill.discount)}`)); }
  if (taxed) {
    sums.push(row('Taxable value', m(bill.taxable)));
    if (bill.cgst || bill.sgst) { sums.push(row('CGST', m(bill.cgst))); sums.push(row('SGST', m(bill.sgst))); }
    if (bill.igst) sums.push(row('IGST', m(bill.igst)));
    if (bill.taxMode === 'gst_inclusive') sums.push(row('<small>Prices include GST.</small>', ''));
  }
  sums.push(row('TOTAL', m(bill.total), 'total'));
  for (const p of bill.payments || []) sums.push(row(esc(PAY[p.method] || p.method), m(p.amount)));
  if (bill.change > 0) sums.push(row('Change', m(bill.change)));
  if (bill.due > 0) sums.push(row('BALANCE DUE', m(bill.due), 'due'));
  if (bill.returnedAmount > 0 && bill.status !== 'returned') sums.push(row('Returned so far', m(bill.returnedAmount)));
  if (bill.pointsEarned > 0) sums.push(row('Points earned', esc(bill.pointsEarned)));
  if (bill.pointsUsed > 0) sums.push(row('Points used', esc(bill.pointsUsed)));
  if (opts.pointsBalance != null) sums.push(row('Points balance', esc(opts.pointsBalance)));
  const lang = ['en', 'ta', 'hi'].includes(opts.lang) ? opts.lang : 'en';
  const title = taxed ? 'Tax invoice' : 'Bill';
  return `<!doctype html><html lang="${lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">`
    + `<title>${esc(title)} ${esc(bill.number || '')}</title><style>`
    + `@page{size:${opts.size || 'A5'};margin:10mm}body{font:14px/1.4 system-ui,"Noto Sans Tamil","Noto Sans Devanagari",sans-serif;color:#111;max-width:${width};margin:0 auto;padding:8px}`
    + `h1{font-size:20px;margin:0}table{width:100%;border-collapse:collapse}td{padding:3px 4px;vertical-align:top;border-bottom:1px solid #ddd}`
    + `.r{text-align:right;white-space:nowrap}.c{text-align:center}.total td{font-weight:700;border-top:2px solid #111}.due td{font-weight:700}`
    + `.stamp{font-size:22px;font-weight:700;text-align:center;border:3px solid #111;padding:4px;margin:8px 0}small{color:#555}`
    + `</style></head><body>`
    + `<div class="c"><h1>${esc(shop.name)}</h1>${shop.address ? `<div>${esc(shop.address)}</div>` : ''}${shop.phone ? `<div>Ph ${esc(shop.phone)}</div>` : ''}`
    + `${shop.gstin && taxed ? `<div>GSTIN ${esc(shop.gstin)}</div>` : ''}</div>`
    + `<p><b>${esc(title)}</b> ${esc(bill.number || '')}<br>${esc(opts.at || '')}`
    + `${opts.customerName ? `<br>Customer: ${esc(opts.customerName)}${opts.customerPhone ? ` (${esc(opts.customerPhone)})` : ''}` : ''}`
    + `${opts.cashier ? `<br>Served by: ${esc(opts.cashier)}` : ''}</p>`
    + `${bill.status === 'returned' ? '<div class="stamp">RETURNED</div>' : ''}`
    + `<table><thead><tr><td>#</td><td>Item</td><td class="r">Qty x Price</td><td class="r">Amount</td></tr></thead><tbody>${lines}${sums.join('')}</tbody></table>`
    + `<p class="c">${esc(shop.footer || 'Thank you. Visit again.')}</p></body></html>`;
};

module.exports = { render, esc };
