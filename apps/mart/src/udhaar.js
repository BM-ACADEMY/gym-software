'use strict';
// Udhaar (pay-later) ledger. Whole rupees, currency INR. entries: { customerId, type: 'credit' | 'payment', amount, date }.
// Payments clear the OLDEST credit first (FIFO), so "how old is the oldest unpaid credit" is a fair overdue test.
const { valid, days } = require('./dates');
const bad = (m) => { const e = new Error(m); e.code = 'UDHAAR_INVALID'; throw e; };

function clean(entries) {
  return (entries || []).map((e) => {
    if (!e || (e.type !== 'credit' && e.type !== 'payment')) bad('Entry type must be credit or payment.');
    if (!Number.isInteger(e.amount) || e.amount <= 0) bad('Amount must be a whole rupee amount above zero.');
    if (!valid(e.date)) bad('Entry needs a date.');
    return e;
  });
}
const group = (entries) => { const g = {}; for (const e of clean(entries)) (g[e.customerId] = g[e.customerId] || []).push(e); return g; };

// What each customer owes now (never below zero; an overpayment shows as `advance`).
function balances(entries) {
  const out = {};
  for (const [id, list] of Object.entries(group(entries))) {
    const net = list.reduce((a, e) => a + (e.type === 'credit' ? e.amount : -e.amount), 0);
    out[id] = { due: Math.max(0, net), advance: Math.max(0, -net), currency: 'INR' };
  }
  return out;
}
// Credit limit check before saving a pay-later bill. limit null or undefined means no limit set.
function canGiveCredit({ balance, add, limit }) {
  if (!Number.isInteger(add) || add <= 0) return { ok: false, reason: 'Credit amount must be above zero.' };
  if (limit === null || limit === undefined) return { ok: true };
  const after = (balance || 0) + add;
  return after <= limit ? { ok: true } : { ok: false, reason: `This would take the balance to ${after} rupees, above the limit of ${limit}.` };
}
// Customers whose oldest unpaid credit is `graceDays` or more old. Largest amount first.
function overdue(entries, today, graceDays = 15) {
  if (!valid(today)) return [];
  const out = [];
  for (const [id, list] of Object.entries(group(entries))) {
    const credits = list.filter((e) => e.type === 'credit').sort((a, b) => a.date.localeCompare(b.date)).map((e) => ({ date: e.date, left: e.amount }));
    let paid = list.filter((e) => e.type === 'payment').reduce((a, e) => a + e.amount, 0);
    for (const c of credits) { const take = Math.min(c.left, paid); c.left -= take; paid -= take; }
    const open = credits.filter((c) => c.left > 0);
    if (!open.length) continue;
    const due = open.reduce((a, c) => a + c.left, 0); const age = days(open[0].date, today);
    if (age >= graceDays) out.push({ customerId: id, due, currency: 'INR', oldestDate: open[0].date, daysOld: age, reason: `Owes ${due} rupees; the oldest ${open[0].left} rupees is ${age} days old.` });
  }
  return out.sort((a, b) => b.due - a.due);
}
module.exports = { balances, canGiveCredit, overdue };
