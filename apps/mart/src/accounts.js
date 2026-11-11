'use strict';
// Accounts in plain words (PRODUCT_PRINCIPLES section 7, area 1). Whole rupees, currency INR. We do NOT file GST: we
// only add up what the shop has and give the CA a file.
const { int, valid, days } = require('./dates');
const bad = (m, code = 'ACCOUNTS_INVALID') => { const e = new Error(m); e.code = code; throw e; };

// Expected cash in the drawer at day end. All inputs are whole rupees >= 0.
function expectedCash({ opening = 0, cashSales = 0, udhaarCashIn = 0, expensesCash = 0, supplierCashOut = 0 }) {
  for (const v of [opening, cashSales, udhaarCashIn, expensesCash, supplierCashOut]) if (!Number.isInteger(v) || v < 0) bad('Cash amounts must be whole rupees, not negative.');
  return { expected: opening + cashSales + udhaarCashIn - expensesCash - supplierCashOut, currency: 'INR' };
}
const dayClose = ({ expected, counted }) => { if (!Number.isInteger(counted) || counted < 0) bad('Counted cash must be whole rupees.'); const diff = counted - expected; return { expected, counted, diff, ok: diff === 0, kind: diff < 0 ? 'short' : diff > 0 ? 'extra' : 'match', currency: 'INR', note: diff === 0 ? 'Cash matches.' : `${Math.abs(diff)} rupees ${diff < 0 ? 'short' : 'extra'}. Check expenses and udhaar payments that were not entered.` }; };

const EXPENSE_CATEGORIES = ['rent', 'salary', 'electricity', 'transport', 'packaging', 'repair', 'tea_food', 'other'];
function expensesByCategory(expenses) {
  const g = {}; let total = 0;
  for (const e of expenses || []) { if (!e || !Number.isInteger(e.amount) || e.amount <= 0) continue; const k = EXPENSE_CATEGORIES.includes(e.category) ? e.category : 'other'; g[k] = (g[k] || 0) + e.amount; total += e.amount; }
  return { total, currency: 'INR', byCategory: Object.entries(g).map(([category, amount]) => ({ category, amount })).sort((a, b) => b.amount - a.amount) };
}

// Supplier purchases: { id, supplierId, day, amount, paid }. Dues per supplier, oldest first.
function supplierDues(purchases, today) {
  const g = {};
  for (const p of purchases || []) { const due = (p.amount || 0) - (p.paid || 0); if (!(due > 0)) continue; const s = (g[p.supplierId] = g[p.supplierId] || { supplierId: String(p.supplierId), due: 0, oldestDay: p.day }); s.due += due; if (p.day < s.oldestDay) s.oldestDay = p.day; }
  return Object.values(g).map((s) => ({ ...s, currency: 'INR', daysOld: valid(today) ? days(s.oldestDay, today) : null })).sort((a, b) => b.due - a.due);
}
// Pay a supplier: clears the oldest purchases first. Returns [{ id, paid }] new paid totals. Cannot pay more than is owed.
function allocatePayment(purchases, amount) {
  if (!Number.isInteger(amount) || amount <= 0) bad('Payment must be whole rupees above zero.');
  const open = (purchases || []).filter((p) => p.amount - (p.paid || 0) > 0).sort((a, b) => a.day.localeCompare(b.day));
  const owed = open.reduce((a, p) => a + p.amount - (p.paid || 0), 0);
  if (amount > owed) bad(`This supplier is owed ${owed} rupees. A payment cannot be more than that.`);
  let left = amount; const out = [];
  for (const p of open) { if (left <= 0) break; const take = Math.min(left, p.amount - (p.paid || 0)); out.push({ id: p.id, paid: (p.paid || 0) + take }); left -= take; }
  return out;
}

// Profit and loss for a period. bills: { total, taxable, gst, status, lines:[{itemId, qty, net? total? taxable}] }, costOf: { itemId: cost }.
// Sales are shown WITHOUT GST (GST is the government's money). Items with no cost price are listed, and the profit then says it is an estimate.
function profitAndLoss({ bills, expenses, costOf = {} }) {
  let sales = 0; let gst = 0; let cogs = 0; const unknown = new Set();
  for (const b of bills || []) {
    if (!b || b.status === 'returned') continue;
    sales += int(b.taxable); gst += int(b.gst);
    for (const l of b.lines || []) { if (!l.itemId) continue; const c = costOf[String(l.itemId)]; if (c === undefined || c === null) unknown.add(String(l.itemId)); else cogs += int(c * l.qty); }
  }
  const exp = expensesByCategory(expenses).total; const gross = sales - cogs; const net = gross - exp;
  const estimate = unknown.size > 0;
  return { sales, gst, costOfGoods: cogs, grossProfit: gross, expenses: exp, netProfit: net, currency: 'INR', estimate, itemsWithoutCost: [...unknown],
    plain: `You sold ${sales} rupees (without GST). The goods cost you ${cogs}, so you made ${gross} before expenses. Expenses were ${exp}. What is left: ${net} rupees.${estimate ? ` This is an estimate: ${unknown.size} item(s) have no cost price entered.` : ''}` };
}

// CA file: one row per bill. Text cells that start with = + - @ get a leading apostrophe so a spreadsheet never runs them as a formula.
const cell = (v) => { let s = v === null || v === undefined ? '' : String(v); if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
function caCsv({ bills, expenses, dayOf }) {
  const rows = [['Type', 'Date', 'Number or category', 'Taxable', 'CGST', 'SGST', 'IGST', 'Total', 'Status or note', 'Currency']];
  for (const b of bills || []) rows.push(['Sale', dayOf(b), b.number, int(b.taxable), int(b.cgst), int(b.sgst), int(b.igst), int(b.total), b.status, 'INR']);
  for (const e of expenses || []) rows.push(['Expense', e.day, e.category, '', '', '', '', int(e.amount), e.note || '', 'INR']);
  return rows.map((r) => r.map(cell).join(',')).join('\n') + '\n';
}
module.exports = { expectedCash, dayClose, EXPENSE_CATEGORIES, expensesByCategory, supplierDues, allocatePayment, profitAndLoss, caCsv };
