'use strict';
// Accounts for a shop, in plain words. Whole rupees (INR). Pure. We do NOT file GST; we prepare a summary and a CSV for the CA.
const isDate = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s + 'T00:00:00Z'));
const int = (n) => Number.isInteger(n) && n >= 0;
const CATEGORIES = ['rent', 'salary', 'electricity', 'transport', 'packing', 'tailoring', 'repairs', 'marketing', 'tea_food', 'other'];

function validateExpense(e) {
  if (!e || !isDate(e.date)) return { error: 'Pick the date.' };
  if (!int(e.amount) || e.amount < 1) return { error: 'Amount must be a whole rupee amount.' };
  const category = CATEGORIES.includes(e.category) ? e.category : 'other';
  const mode = ['cash', 'upi', 'bank'].includes(e.mode) ? e.mode : 'cash';
  return { value: { date: e.date, amount: e.amount, category, mode, note: String(e.note || '').trim().slice(0, 120), currency: 'INR' } };
}
// Cash day close: opening + cash in - cash out = expected; counted is what is in the drawer.
function dayClose({ opening, cashIn, cashOut, counted }) {
  if (![opening, cashIn, cashOut, counted].every((n) => Number.isInteger(n))) return { error: 'All amounts must be whole rupees.' };
  const expected = opening + cashIn - cashOut; const difference = counted - expected;
  return { expected, counted, difference, status: difference === 0 ? 'matched' : difference < 0 ? 'short' : 'excess', text: difference === 0 ? 'Cash matches.' : `Cash is Rs ${Math.abs(difference)} ${difference < 0 ? 'short' : 'more'} than expected.` };
}
const byCategory = (expenses) => { const o = {}; for (const e of expenses || []) o[e.category] = (o[e.category] || 0) + e.amount; return o; };
// Profit and loss for a period. sales = taxable sales EXCLUDING GST; cogs = cost of goods sold; both given by the caller.
function profitAndLoss({ sales, cogs, expenses }) {
  const exp = (expenses || []).reduce((a, e) => a + e.amount, 0);
  const gross = sales - cogs; const net = gross - exp;
  return { sales, cogs, grossProfit: gross, expenses: exp, netProfit: net, currency: 'INR', text: net >= 0 ? `You earned Rs ${net} after all expenses.` : `You lost Rs ${-net} after all expenses.`, note: 'Cost of goods is from the cost price you entered; check it before relying on this.' };
}
// Supplier bills: [{id,supplier,amount,paid,dueOn}] -> what is owed, split by how late.
function supplierDues(bills, today) {
  const d = (s) => Date.parse(s + 'T00:00:00Z'); const out = { total: 0, notDue: 0, late1to30: 0, late31plus: 0, rows: [] };
  for (const b of bills || []) {
    const owe = (b.amount || 0) - (b.paid || 0); if (owe <= 0) continue;
    const late = Math.round((d(today) - d(b.dueOn)) / 86400000);
    out.total += owe; if (late <= 0) out.notDue += owe; else if (late <= 30) out.late1to30 += owe; else out.late31plus += owe;
    out.rows.push({ id: b.id, supplier: b.supplier, owe, lateDays: Math.max(0, late) });
  }
  out.rows.sort((a, b) => b.lateDays - a.lateDays || b.owe - a.owe); out.currency = 'INR'; return out;
}
// GST summary from bill lines [{taxable, gstRate}] (taxable excludes GST). CGST/SGST vs IGST depends on the bill, summed by the caller.
function gstSummary(lines) {
  const by = {}; for (const l of lines || []) { if (!int(l.taxable)) continue; const r = String(l.gstRate || 0); const x = by[r] = by[r] || { rate: Number(r), taxable: 0, tax: 0 }; x.taxable += l.taxable; x.tax += Math.round(l.taxable * Number(r) / 100); }
  const rows = Object.values(by).sort((a, b) => a.rate - b.rate);
  return { rows, taxable: rows.reduce((a, r) => a + r.taxable, 0), tax: rows.reduce((a, r) => a + r.tax, 0), currency: 'INR', note: 'Summary for your CA. We do not file GST.' };
}
// CSV for the CA. Cells starting with = + - @ are prefixed so a spreadsheet never runs them as a formula.
const cell = (v) => { let s = String(v == null ? '' : v); if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
const toCsv = (header, rows) => [header.map(cell).join(','), ...rows.map((r) => header.map((h) => cell(r[h])).join(','))].join('\n');
module.exports = { CATEGORIES, validateExpense, dayClose, byCategory, profitAndLoss, supplierDues, gstSummary, toCsv, isDate };
