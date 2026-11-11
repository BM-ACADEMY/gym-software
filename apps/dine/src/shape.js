'use strict';
// Turns a stored order into the "bill" shape the reports use. Pure. Dates are India time (IST, UTC+5:30).
const IST = 5.5 * 3600000;
const istParts = (d) => { const t = new Date(new Date(d).getTime() + IST); return { date: t.toISOString().slice(0, 10), hour: t.getUTCHours(), day: t.getUTCDay(), minutes: t.getUTCHours() * 60 + t.getUTCMinutes() }; };
function orderToBill(o) {
  const t = o.totals || { lines: [], taxable: 0, cgst: 0, sgst: 0, igst: 0 };
  const p = istParts(o.paidAt || o.createdAt);
  return { date: p.date, hour: p.hour, staffId: o.staffId || null, number: o.number, total: o.grandTotal, taxable: t.taxable, cgst: t.cgst, sgst: t.sgst, igst: t.igst, discount: t.discount || 0, subtotal: t.subtotal || 0, currency: o.currency || 'INR', lines: (t.lines || []).map((l) => ({ name: l.name, qty: l.qty, total: l.total, taxable: l.taxable, gst: l.gst, rate: l.rate, itemKey: l.itemKey || null })), payments: o.payments || [] };
}
// Cash taken on one day: cash payments minus the change handed back (settle() stores received per method; change comes out of cash).
function cashTaken(orders, date) {
  return orders.filter((o) => o.status === 'paid' && istParts(o.paidAt).date === date).reduce((a, o) => a + (o.payments || []).filter((p) => p.method === 'cash').reduce((x, p) => x + p.amount, 0) - ((o.settle && o.settle.change) || 0), 0);
}
module.exports = { istParts, orderToBill, cashTaken };
