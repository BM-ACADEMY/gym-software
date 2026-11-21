'use strict';
// Accounts in plain words: cash book, day close, expenses, dues, profit and loss, GST summary, CA export. Whole rupees, INR.
// Pure: no database. We do NOT file GST; the export is for the owner's CA (Decision, PRODUCT_PRINCIPLES section 7).
const int = (n) => Math.round(Number(n) || 0);
const sum = (a, f) => a.reduce((t, x) => t + int(f(x)), 0);
// A voided bill is never a sale: every total below ignores it.
const live = (bills) => (bills || []).filter((b) => b && b.status !== 'void');
const CATEGORIES = ['rent', 'salary', 'products', 'electricity', 'marketing', 'repairs', 'other'];

// Cash kept from one bill: cash payments minus change handed back.
const cashKept = (bill) => Math.max(0, sum((bill.payments || []).filter((p) => p.method === 'cash'), (p) => p.amount) - int(bill.change));
// Money received by method for a list of bills (cash after change; other methods as paid; credit is not money).
function receivedByMethod(bills) {
  const out = {};
  for (const b of bills) for (const p of b.payments || []) { if (p.method === 'credit') continue; out[p.method] = (out[p.method] || 0) + int(p.amount); }
  const change = sum(bills, (b) => b.change); if (change) out.cash = Math.max(0, (out.cash || 0) - change);
  return out;
}
// Day close: what the cash drawer should hold versus what was counted.
function dayClose({ openingCash, bills, expenses, countedCash, refunds = [] }) {
  const cashSales = sum(live(bills), cashKept); const cashRefunds = sum((refunds || []).filter((r) => r.method === 'cash'), (r) => r.amount);
  const cashExpenses = sum((expenses || []).filter((e) => e.method === 'cash' && e.paid !== false), (e) => e.amount);
  const expected = int(openingCash) + cashSales - cashExpenses - cashRefunds;
  const difference = int(countedCash) - expected;
  return { openingCash: int(openingCash), cashSales, cashExpenses, cashRefunds, expected, counted: int(countedCash), difference, currency: 'INR',
    text: difference === 0 ? 'Cash matches.' : difference < 0 ? `Cash is short by Rs ${-difference}.` : `Cash is over by Rs ${difference}.` };
}
// Profit and loss for a period. Income is sales before GST (GST belongs to the government). Commission is a cost of sales.
function profitAndLoss({ bills, expenses, commissionTotal, refunds = [] }) {
  bills = live(bills); const refundedTaxable = sum(refunds || [], (r) => r.taxable); const refundsTotal = sum(refunds || [], (r) => r.amount);
  const income = sum(bills, (b) => b.taxable) - refundedTaxable; const discounts = sum(bills, (b) => b.discount);
  const byCat = {}; for (const e of expenses || []) { const c = CATEGORIES.includes(e.category) ? e.category : 'other'; byCat[c] = (byCat[c] || 0) + int(e.amount); }
  const expenseTotal = sum(Object.values(byCat), (x) => x); const commission = int(commissionTotal);
  const profit = income - commission - expenseTotal;
  return { income, refundsTotal, discountsGiven: discounts, commission, expensesByCategory: byCat, expenseTotal, profit, currency: 'INR',
    text: `You sold Rs ${income} (before GST). After Rs ${commission} staff commission and Rs ${expenseTotal} expenses, you ${profit >= 0 ? 'kept' : 'lost'} Rs ${Math.abs(profit)}.` };
}
// GST by rate from bill lines (taxable, cgst/sgst/igst split comes from the bill totals).
function gstSummary(bills, refunds = []) {
  bills = live(bills); const refundedGst = sum(refunds || [], (r) => r.gst);
  const byRate = {}; let cgst = 0, sgst = 0, igst = 0, taxable = 0, gst = 0;
  for (const b of bills) {
    cgst += int(b.cgst); sgst += int(b.sgst); igst += int(b.igst);
    for (const l of b.lines || []) { const r = String(l.rate || 0); byRate[r] = byRate[r] || { taxable: 0, gst: 0 }; byRate[r].taxable += int(l.taxable); byRate[r].gst += int(l.gst); taxable += int(l.taxable); gst += int(l.gst); }
  }
  return { byRate, taxable, gst, cgst, sgst, igst, refundedGst, netGst: gst - refundedGst, currency: 'INR' };
}
const customerDues = (bills) => live(bills).filter((b) => int(b.due) > 0).map((b) => ({ billNumber: b.number, customerId: b.customerId ? String(b.customerId) : null, due: int(b.due), date: b.date })).sort((a, b) => b.due - a.due);
const supplierDues = (expenses) => (expenses || []).filter((e) => e.paid === false).map((e) => ({ id: String(e._id || e.id), paidTo: e.paidTo, category: e.category, amount: int(e.amount), dueDate: e.dueDate || null })).sort((a, b) => String(a.dueDate || '9').localeCompare(String(b.dueDate || '9')));
// A cell that starts with = + - @ could run as a formula in a spreadsheet: neutralise it. Quote anything with a comma, quote or newline.
const cell = (v) => { let s = v === null || v === undefined ? '' : String(v); if (/^[=+\-@\t\r]/.test(s) && !/^-?\d+(\.\d+)?$/.test(s)) s = "'" + s; return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
function caCsv({ bills, expenses, refunds = [] }) {
  const rows = [['Type', 'Date', 'Number or payee', 'Category', 'Taxable', 'GST', 'Total', 'Currency']];
  for (const b of live(bills)) rows.push(['Sale', b.date, b.number, 'sales', int(b.taxable), int(b.gst), int(b.total), 'INR']);
  for (const r of refunds || []) rows.push(['Refund', r.date, r.number || '', 'refund', -int(r.taxable), -int(r.gst), -int(r.amount), 'INR']);
  for (const e of expenses || []) rows.push(['Expense', e.date, e.paidTo || '', e.category, int(e.amount), 0, int(e.amount), 'INR']);
  return rows.map((r) => r.map(cell).join(',')).join('\n') + '\n';
}
module.exports = { live, CATEGORIES, cashKept, receivedByMethod, dayClose, profitAndLoss, gstSummary, customerDues, supplierDues, caCsv, cell };
