'use strict';
// Accounts in plain words (all-in-one standard area 1). Pure; whole rupees with a currency code (INR). We do NOT file GST:
// gstSummary only adds up what the bills already say, and the export is a CSV the CA can open. Nothing here is a GST return.
const { allocate } = require('../../../packages/core-pos/src/bill');
const bad = (m) => { const e = new Error(m); e.code = 'ACCOUNTS_INVALID'; throw e; };
const rs = (n) => Number.isInteger(n) && n >= 0;

// Cash book: only cash entries. entries: [{ date, type:'in'|'out', amount, category, note }]. Returns each row with a running balance.
function cashBook({ opening = 0, entries = [] }) {
  if (!Number.isInteger(opening)) bad('Opening cash must be whole rupees.');
  let bal = opening; let tin = 0; let tout = 0;
  const rows = entries.map((e) => {
    if (!rs(e.amount) || !['in', 'out'].includes(e.type)) bad('Each cash entry needs a type and a whole-rupee amount.');
    if (e.type === 'in') { bal += e.amount; tin += e.amount; } else { bal -= e.amount; tout += e.amount; }
    return { ...e, balance: bal };
  });
  return { opening, in: tin, out: tout, closing: bal, rows, currency: 'INR' };
}
// Day close: cash the bills and entries say should be in the drawer versus what was counted.
function dayClose({ opening, cashSales, cashIn = 0, cashOut = 0, counted }) {
  for (const v of [opening, cashSales, cashIn, cashOut, counted]) if (!rs(v)) bad('Day close figures must be whole rupees, zero or more.');
  const expected = opening + cashSales + cashIn - cashOut; const difference = counted - expected;
  return { expected, counted, difference, status: difference === 0 ? 'ok' : difference < 0 ? 'short' : 'over', words: difference === 0 ? 'Cash matches the bills.' : difference < 0 ? 'Cash is Rs ' + (-difference) + ' short.' : 'Cash is Rs ' + difference + ' more than the bills say.', currency: 'INR' };
}
const byCategory = (expenses) => {
  const m = {};
  for (const e of expenses) { if (!rs(e.amount)) bad('Expense amounts must be whole rupees.'); const c = (e.category || 'Other').trim() || 'Other'; m[c] = (m[c] || 0) + e.amount; }
  const total = Object.values(m).reduce((a, b) => a + b, 0);
  return { total, rows: Object.entries(m).map(([category, amount]) => ({ category, amount, sharePercent: total ? Math.round((amount / total) * 1000) / 10 : 0 })).sort((a, b) => b.amount - a.amount), currency: 'INR' };
};
// Supplier dues with ageing. purchases: [{ supplier, date, amount }], payments: [{ supplier, date, amount }]. Oldest purchases are treated as paid first.
const dayDiff = (a, b) => Math.round((Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / 86400000);
function supplierDues(purchases, payments, today) {
  const out = {};
  for (const s of new Set([...purchases, ...payments].map((x) => x.supplier))) {
    let paid = payments.filter((p) => p.supplier === s).reduce((a, p) => a + p.amount, 0);
    const open = purchases.filter((p) => p.supplier === s).sort((a, b) => a.date.localeCompare(b.date)).map((p) => {
      const used = Math.min(paid, p.amount); paid -= used; return { date: p.date, left: p.amount - used };
    }).filter((p) => p.left > 0);
    const age = { d0_30: 0, d31_60: 0, d61_plus: 0 };
    for (const p of open) { const d = dayDiff(p.date, today); if (d <= 30) age.d0_30 += p.left; else if (d <= 60) age.d31_60 += p.left; else age.d61_plus += p.left; }
    const due = open.reduce((a, p) => a + p.left, 0);
    if (due > 0 || paid > 0) out[s] = { supplier: s, due, advance: paid, age, oldest: open[0] ? open[0].date : null };
  }
  return Object.values(out).sort((a, b) => b.due - a.due);
}
// Profit and loss in plain words. All amounts whole rupees; sales are BEFORE GST (GST is not the owner's income).
function profitAndLoss({ salesBeforeGst, costOfFood, staffCost = 0, expenses = [] }) {
  for (const v of [salesBeforeGst, costOfFood, staffCost]) if (!rs(v)) bad('Profit and loss figures must be whole rupees, zero or more.');
  const ex = byCategory(expenses); const gross = salesBeforeGst - costOfFood; const net = gross - staffCost - ex.total;
  const pct = (n) => (salesBeforeGst > 0 ? Math.round((n / salesBeforeGst) * 1000) / 10 : null);
  return { salesBeforeGst, costOfFood, grossProfit: gross, grossPercent: pct(gross), staffCost, otherExpenses: ex.total, expenseRows: ex.rows, netProfit: net, netPercent: pct(net), currency: 'INR',
    words: 'You sold Rs ' + salesBeforeGst + ' before GST. Food and drink cost Rs ' + costOfFood + ', staff Rs ' + staffCost + ' and other expenses Rs ' + ex.total + '. ' + (net >= 0 ? 'You are left with Rs ' + net + '.' : 'You are Rs ' + (-net) + ' in loss.') };
}
// GST summary by rate from computed bills (core-pos bill.compute results). Adds up only; it is not a return.
function gstSummary(bills) {
  const rate = {}; let taxable = 0; let cgst = 0; let sgst = 0; let igst = 0;
  for (const b of bills) for (const l of b.lines) { const r = (rate[l.rate] = rate[l.rate] || { rate: l.rate, taxable: 0, gst: 0 }); r.taxable += l.taxable; r.gst += l.gst; }
  for (const b of bills) { taxable += b.taxable; cgst += b.cgst; sgst += b.sgst; igst += b.igst; }
  return { byRate: Object.values(rate).sort((a, b) => a.rate - b.rate), taxable, cgst, sgst, igst, totalGst: cgst + sgst + igst, note: 'This adds up your bills. It is not a GST return. Your CA files the return.', currency: 'INR' };
}
// CSV for the CA. Cells starting with = + - @ are prefixed with an apostrophe so a spreadsheet never runs them as a formula.
const cell = (v) => { let s = v === null || v === undefined ? '' : String(v); if (/^[=+\-@\t\r]/.test(s) && !/^-?\d+(\.\d+)?$/.test(s)) s = "'" + s; return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
const toCsv = (headers, rows) => [headers, ...rows].map((r) => r.map(cell).join(',')).join('\r\n') + '\r\n';
function caExport(bills) {
  return toCsv(['Date', 'Bill no', 'Taxable', 'CGST', 'SGST', 'IGST', 'Total', 'Currency'], bills.map((b) => [b.date, b.number, b.taxable, b.cgst, b.sgst, b.igst, b.total, b.currency || 'INR']));
}
module.exports = { cashBook, dayClose, byCategory, supplierDues, profitAndLoss, gstSummary, toCsv, caExport, allocate };
