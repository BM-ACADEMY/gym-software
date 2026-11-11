'use strict';
// Printable KOT and bill (Phase 2 item 2). Pure. The bill page comes from core-pos billHtml (A4 or A5, prints to PDF from any phone,
// Tamil and Hindi letters print correctly). The FSSAI number is the owner's own entry and goes in the bill footer.
// Service charge is shown as its own line. Whether it carries GST is a CA question (CA_LAWYER_ITEMS.md); we add no tax to it here.
const billHtml = require('../../../packages/core-pos/src/billHtml');
const { esc } = billHtml;
const IST = 5.5 * 3600000;
const istText = (d) => { const t = new Date(new Date(d).getTime() + IST); return t.toISOString().slice(0, 10) + ' ' + t.toISOString().slice(11, 16) + ' IST'; };

// order: a stored order (status billed or paid). venue: { name, address, phone, fssai }. opts: { size, taxMode, cashier, customerName, customerPhone, at }
function billPrintHtml(order, venue, opts = {}) {
  if (!order || !order.totals || !Array.isArray(order.totals.lines) || !order.totals.lines.length) { const e = new Error('Bill the order first.'); e.code = 'BILL_HTML_INVALID'; throw e; }
  const t = order.totals; const sc = Math.round(order.serviceCharge || 0);
  const lines = t.lines.map((l) => ({ name: l.name, qty: l.qty, unitPrice: l.qty ? Math.round(l.taxable / l.qty) : 0, total: l.total, rate: l.rate }));
  if (sc > 0) lines.push({ name: 'Service charge', qty: 1, unitPrice: sc, total: sc, rate: 0 });
  const paid = order.status === 'paid';
  const bill = {
    number: order.number, lines, taxMode: opts.taxMode || (t.gst > 0 ? 'gst_exclusive' : 'none'), subtotal: t.subtotal, discount: t.discount || 0, taxable: t.taxable, cgst: t.cgst, sgst: t.sgst, igst: t.igst,
    total: Math.round(order.grandTotal), payments: paid ? order.payments : [], change: paid && order.settle ? order.settle.change : 0, due: paid ? 0 : 0, currency: order.currency || 'INR', status: 'paid',
    returnedAmount: order.returnedAmount || 0,
  };
  const footer = (venue.fssai ? 'FSSAI Lic. No. ' + venue.fssai + '. ' : '') + 'Thank you. Visit again.';
  return billHtml.render(bill, { name: venue.name, address: venue.address, phone: venue.phone, footer }, { size: opts.size || 'A5', at: opts.at || istText(order.paidAt || order.updatedAt || order.createdAt || new Date()), cashier: opts.cashier, customerName: opts.customerName, customerPhone: opts.customerPhone });
}

// The kitchen slip: big letters, no prices. lines: the lines for ONE station that are not void.
function kotPrintHtml(order, station, venue, at) {
  const ls = (order.lines || []).filter((l) => l.status !== 'void' && (l.station || 'kitchen') === station && l.status !== 'new');
  if (!ls.length) { const e = new Error('Nothing sent to the ' + station + ' yet.'); e.code = 'ORDER_INVALID'; throw e; }
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>KOT ${esc(order.number)}</title><style>`
    + `@page{size:80mm auto;margin:4mm}body{font:18px/1.35 system-ui,"Noto Sans Tamil","Noto Sans Devanagari",sans-serif;max-width:76mm;margin:0 auto;color:#000}h1{font-size:20px;margin:0}`
    + `.m{font-size:14px}ul{list-style:none;padding:0;margin:8px 0}li{padding:4px 0;border-bottom:1px dashed #666}.q{font-weight:700}small{font-size:14px}`
    + `</style></head><body><h1>${esc(String(station).toUpperCase())} · ${esc(order.table || order.type || '')}</h1><div class="m">${esc(order.number)} · ${esc(at || '')}${venue && venue.name ? ' · ' + esc(venue.name) : ''}</div>`
    + `<ul>${ls.map((l) => `<li><span class="q">${esc(l.qty)} x</span> ${esc(l.name)}${l.note ? `<br><small>${esc(l.note)}</small>` : ''}</li>`).join('')}</ul></body></html>`;
}
module.exports = { billPrintHtml, kotPrintHtml, istText };
