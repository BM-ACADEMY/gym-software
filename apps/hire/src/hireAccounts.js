'use strict';
// Hire accounts, whole rupees (INR). Pure. We do NOT file GST: we prepare a summary and a CSV for the CA.
// Money in = placement fees marked paid (fee + GST). GST collected is not income: it is shown on its own line.
const isDate = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s + 'T00:00:00Z'));
const CATEGORIES = ['salary', 'rent', 'job_portals', 'travel', 'marketing', 'software', 'tea_food', 'other'];
const MODES = ['cash', 'upi', 'bank'];
function validateExpense(e) {
  if (!e || !isDate(e.date)) return { error: 'Pick the date.' };
  if (!Number.isInteger(e.amount) || e.amount < 1 || e.amount > 100000000) return { error: 'Amount must be whole rupees, above zero.' };
  return { value: { date: e.date, amount: e.amount, category: CATEGORIES.includes(e.category) ? e.category : 'other', mode: MODES.includes(e.mode) ? e.mode : 'bank', note: String(e.note || '').trim().slice(0, 120), currency: 'INR' } };
}
const day = (d) => (d ? new Date(d).toISOString().slice(0, 10) : null);
const within = (d, from, to) => d && d >= from && d <= to;
// Profit and loss for a date range. income = fee (without GST) of fees PAID in the range; expenses by date.
function profitAndLoss({ fees = [], expenses = [], from, to }) {
  if (!isDate(from) || !isDate(to) || to < from) return { error: 'Give from and to dates like 2026-11-01.' };
  const paid = fees.filter((f) => f.paidAt && within(day(f.paidAt), from, to));
  const income = paid.reduce((a, f) => a + (f.fee || 0), 0); const gst = paid.reduce((a, f) => a + (f.gst || 0), 0);
  const exp = expenses.filter((x) => within(x.date, from, to)); const spent = exp.reduce((a, x) => a + x.amount, 0);
  const byCategory = {}; for (const x of exp) byCategory[x.category] = (byCategory[x.category] || 0) + x.amount;
  const net = income - spent;
  return { from, to, income, gstCollected: gst, expenses: spent, byCategory, netProfit: net, currency: 'INR', placementsPaid: paid.length,
    text: net >= 0 ? `You earned Rs ${net} after expenses.` : `You lost Rs ${-net} after expenses.`, note: 'Income is the fee without GST, counted when paid. GST collected is owed to the government. Your CA decides what is final.' };
}
// Cash book: every money-in (paid fee, fee plus GST) and money-out (expense) in date order, with a running balance from `opening`.
function cashBook({ fees = [], expenses = [], from, to, opening = 0 }) {
  if (!isDate(from) || !isDate(to) || to < from) return { error: 'Give from and to dates like 2026-11-01.' };
  if (!Number.isInteger(opening)) return { error: 'Opening balance must be whole rupees.' };
  const rows = [];
  for (const f of fees) if (f.paidAt && within(day(f.paidAt), from, to)) rows.push({ date: day(f.paidAt), kind: 'in', what: 'Placement fee received', amount: f.total || 0 });
  for (const x of expenses) if (within(x.date, from, to)) rows.push({ date: x.date, kind: 'out', what: x.category + (x.note ? ': ' + x.note : ''), amount: x.amount, mode: x.mode });
  rows.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.kind === 'in' ? -1 : 1));
  let bal = opening; for (const r of rows) { bal += r.kind === 'in' ? r.amount : -r.amount; r.balance = bal; }
  return { from, to, opening, closing: bal, rows, currency: 'INR' };
}
// CSV cells that start with = + - @ tab or CR are turned into text so a spreadsheet cannot run them.
const cell = (v) => { let s = v == null ? '' : String(v); if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
const toCsv = (head, rows) => [head.join(','), ...rows.map((r) => head.map((h) => cell(r[h])).join(','))].join('\r\n') + '\r\n';
function caCsv({ fees = [], expenses = [], from, to }) {
  if (!isDate(from) || !isDate(to) || to < from) return { error: 'Give from and to dates like 2026-11-01.' };
  const rows = [];
  for (const f of fees) { const d = day(f.issuedAt); if (within(d, from, to)) rows.push({ date: d, type: 'fee_invoice', category: 'placement_fee', amount: f.fee || 0, gst: f.gst || 0, total: f.total || 0, status: f.paidAt ? 'paid ' + day(f.paidAt) : 'unpaid', currency: 'INR' }); }
  for (const x of expenses) if (within(x.date, from, to)) rows.push({ date: x.date, type: 'expense', category: x.category, amount: x.amount, gst: '', total: x.amount, status: x.mode, currency: 'INR' });
  rows.sort((a, b) => (a.date < b.date ? -1 : 1));
  return { csv: toCsv(['date', 'type', 'category', 'amount', 'gst', 'total', 'status', 'currency'], rows), count: rows.length };
}
module.exports = { CATEGORIES, MODES, isDate, validateExpense, profitAndLoss, cashBook, toCsv, caCsv, cell };
