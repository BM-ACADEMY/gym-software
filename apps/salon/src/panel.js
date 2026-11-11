'use strict';
// Shapes for the owner panel's accounts screens. Pure: the route fetches bills and expenses, this builds the lists the
// manifest tables read (a table needs an array, not an object keyed by name). Whole rupees, INR.
const A = require('./accounts');
const int = (n) => Math.round(Number(n) || 0);

// 'YYYY-MM' -> { from, to } in that calendar month (to = last day). Bad input: null.
function monthRange(month) {
  if (typeof month !== 'string' || !/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) return null;
  const y = Number(month.slice(0, 4)); const m = Number(month.slice(5, 7)); const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return { from: `${month}-01`, to: `${month}-${String(last).padStart(2, '0')}` };
}
// Bills that count as sales (a voided bill never counts).
const live = (bills) => (bills || []).filter((b) => b && b.status !== 'void');

function accountsMonth({ month, bills, expenses, supplierDues }) {
  const lb = live(bills);
  const commissionTotal = lb.reduce((t, b) => t + Object.values(b.commissions || {}).reduce((x, y) => x + int(y), 0), 0);
  const pnl = A.profitAndLoss({ bills: lb, expenses, commissionTotal });
  const gst = A.gstSummary(lb);
  const categories = Object.entries(pnl.expensesByCategory).map(([category, amount]) => ({ category, amount })).sort((a, b) => b.amount - a.amount);
  const gstRates = Object.entries(gst.byRate || {}).map(([rate, v]) => ({ rate: Number(rate), taxable: v.taxable, gst: v.gst })).sort((a, b) => a.rate - b.rate);
  return { month, ...pnl, textRows: [{ text: pnl.text }], categories, gst, gstRates, supplierDues: supplierDues || [], exportNote: 'To give your CA the full list, ask for the accounts file (CSV) for the same dates. We do not file GST for you.' };
}
// Staff discounts list for the owner (who, how much, why).
function staffDiscountRows(bills, staffNames = {}) {
  return live(bills).filter((b) => b.discountBy === 'staff' && int(b.discount) > 0)
    .map((b) => ({ id: String(b._id || b.id || b.number), number: b.number, date: b.date, discount: int(b.discount), percent: int(b.discountPercent), reason: b.discountReason || '', currency: 'INR' }))
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
}
module.exports = { monthRange, live, accountsMonth, staffDiscountRows };
