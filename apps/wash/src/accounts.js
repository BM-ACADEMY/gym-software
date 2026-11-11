'use strict';
// Accounts for a wash business: cash book, expenses by category, supplier dues, profit and loss in plain words, CSV for the CA.
// Whole rupees, INR. We do NOT file GST: the CA export only lists what was billed. Pure.
const CATEGORIES = ['salary', 'water', 'electricity', 'chemicals', 'rent', 'repairs', 'other'];
const isInt = (n) => Number.isInteger(n);

function checkExpense(e) {
  if (!e || !CATEGORIES.includes(e.category)) return { error: 'Choose an expense category' };
  if (!isInt(e.amount) || e.amount < 1 || e.amount > 10000000) return { error: 'Amount is whole rupees' };
  return { ok: true };
}
// Cash book for one day: every cash movement in order. Opening float, cash received from jobs, cash expenses paid out.
function cashBook({ openingFloat = 0, jobs = [], expenses = [] }) {
  const rows = [{ what: 'Opening cash', in: openingFloat, out: 0 }];
  for (const j of jobs) for (const p of j.payments || []) if (p.method === 'cash') rows.push({ what: `Wash ${j.plate}`, in: p.amount, out: 0 });
  for (const x of expenses) if (x.paid !== false && x.cash !== false) rows.push({ what: `${x.category}${x.note ? ': ' + x.note : ''}`, in: 0, out: x.amount });
  const totalIn = rows.reduce((s, r) => s + r.in, 0); const totalOut = rows.reduce((s, r) => s + r.out, 0);
  return { rows, totalIn, totalOut, closing: totalIn - totalOut, currency: 'INR' };
}
// Supplier dues: expenses marked unpaid, grouped by supplier, oldest first.
function supplierDues(expenses) {
  const m = {};
  for (const x of expenses || []) if (x.paid === false) { const k = x.supplier || 'Unnamed supplier'; const e = m[k] || (m[k] = { supplier: k, due: 0, oldest: x.day }); e.due += x.amount; if (x.day < e.oldest) e.oldest = x.day; }
  return Object.values(m).sort((a, b) => a.oldest.localeCompare(b.oldest));
}
// Profit and loss between two dates, with a plain sentence. incentive is what the attendants earned (a cost).
function profitLoss({ revenue, expenses = [], incentive = 0 }) {
  const byCat = {}; let spent = 0;
  for (const x of expenses) { byCat[x.category] = (byCat[x.category] || 0) + x.amount; spent += x.amount; }
  const cost = spent + incentive; const profit = revenue - cost;
  const words = profit >= 0 ? `You earned Rs ${revenue}, spent Rs ${cost}, and kept Rs ${profit}.` : `You earned Rs ${revenue} but spent Rs ${cost}, so you lost Rs ${-profit}.`;
  return { revenue, expenses: spent, incentive, cost, profit, byCategory: byCat, words, currency: 'INR' };
}
// CSV for the CA. Cells starting with = + - @ are prefixed so a spreadsheet never runs them as a formula.
const cell = (v) => { let s = String(v === undefined || v === null ? '' : v); if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
function caCsv({ jobs = [], expenses = [] }) {
  const lines = ['type,date,reference,description,method,amount_inr'];
  for (const j of jobs) { if (j.state !== 'delivered') continue; for (const p of j.payments || []) lines.push(['sale', j.day, '#' + j.number, j.plate, p.method, p.amount].map(cell).join(',')); if (j.passCovered) lines.push(['sale', j.day, '#' + j.number, j.plate + ' (monthly pass)', 'pass', j.passCovered].map(cell).join(',')); }
  for (const x of expenses) lines.push(['expense', x.day, x.supplier || '', x.category + (x.note ? ': ' + x.note : ''), x.paid === false ? 'unpaid' : 'paid', x.amount].map(cell).join(','));
  return lines.join('\n') + '\n';
}
module.exports = { CATEGORIES, checkExpense, cashBook, supplierDues, profitLoss, caCsv };
