'use strict';
// Sales reports, predictions and marketing suggestions (PRODUCT_PRINCIPLES section 7, areas 4, 7, 8).
// PREDICTIONS ARE ESTIMATES (Assumption until checked against real shops): every one says what data it used and never promises.
const { istDay, valid, days, int } = require('./dates');

// ---- sales reports: by day, hour, staff or item ----
function salesBy(bills, dim) {
  const g = {};
  const add = (k, total) => { if (k === null || k === undefined) return; g[k] = g[k] || { key: String(k), total: 0, bills: 0 }; g[k].total += total; g[k].bills += 1; };
  for (const b of bills || []) {
    if (!b || b.status === 'returned' || !b.createdAt) continue;
    if (dim === 'day') add(istDay(b.createdAt), int(b.total));
    else if (dim === 'hour') add(String(new Date(new Date(b.createdAt).getTime() + 5.5 * 3600000).getUTCHours()).padStart(2, '0'), int(b.total));
    else if (dim === 'staff') add(b.by || 'unknown', int(b.total));
    else if (dim === 'item') for (const l of b.lines || []) add(l.name || l.itemId || 'unnamed', int((l.total !== undefined ? l.total : l.net) || 0));
    else throw Object.assign(new Error('Report by day, hour, staff or item.'), { code: 'REPORT_DIM' });
  }
  return Object.values(g).map((x) => ({ ...x, currency: 'INR' })).sort((a, b) => (dim === 'hour' || dim === 'day' ? a.key.localeCompare(b.key) : b.total - a.total));
}

// ---- predictions ----
// Next month's sales range from the last 3 FULL months (needs at least 3). Range is the lowest to the highest of those months.
function nextMonthRange(monthTotals) {
  const m = (monthTotals || []).filter((x) => Number.isFinite(x) && x >= 0).slice(-3);
  if (m.length < 3) return { ok: false, reason: 'Needs three full months of sales before an estimate means anything.' };
  const avg = Math.round(m.reduce((a, b) => a + b, 0) / 3);
  return { ok: true, estimate: true, low: int(Math.min(...m)), likely: avg, high: int(Math.max(...m)), currency: 'INR', basedOn: m.map(int), note: 'An estimate from your last three months. Festivals, price changes and weather can move it. It is not a promise.' };
}
// Busy and slow hours or weekdays: share of bills. needs at least `minBills` bills to say anything.
function busySlow(bills, minBills = 50) {
  const list = (bills || []).filter((b) => b && b.status !== 'returned' && b.createdAt);
  if (list.length < minBills) return { ok: false, reason: `Needs at least ${minBills} bills; you have ${list.length}.` };
  const hours = {}; const wd = {};
  for (const b of list) { const t = new Date(new Date(b.createdAt).getTime() + 5.5 * 3600000); hours[t.getUTCHours()] = (hours[t.getUTCHours()] || 0) + 1; wd[t.getUTCDay()] = (wd[t.getUTCDay()] || 0) + 1; }
  const rank = (o, f) => Object.entries(o).map(([k, c]) => ({ key: f(Number(k)), bills: c, sharePct: Math.round((c * 100) / list.length) })).sort((a, b) => b.bills - a.bills);
  const names = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const h = rank(hours, (k) => `${String(k).padStart(2, '0')}:00`); const d = rank(wd, (k) => names[k]);
  return { ok: true, estimate: true, busyHours: h.slice(0, 3), slowHours: h.slice(-3).reverse(), busyDays: d.slice(0, 2), slowDays: d.slice(-2).reverse(), basedOnBills: list.length };
}
// Customers likely to lapse: 3+ visits, usual gap known, and now more than 1.5 times that gap since the last visit.
// visits: { customerId, name, dates:['YYYY-MM-DD',...], doNotContact }
function lapseRisk(customers, today) {
  if (!valid(today)) return [];
  const out = [];
  for (const c of customers || []) {
    if (!c || c.doNotContact) continue;
    const d = [...new Set((c.dates || []).filter(valid))].sort(); if (d.length < 3) continue;
    const gaps = d.slice(1).map((x, i) => days(d[i], x)); const usual = gaps.reduce((a, b) => a + b, 0) / gaps.length;
    const since = days(d[d.length - 1], today);
    if (usual > 0 && since > usual * 1.5) out.push({ customerId: c.customerId, name: c.name, usualGapDays: Math.round(usual), daysSince: since, estimate: true, reason: `Usually comes every ${Math.round(usual)} days; it has been ${since}. Based on ${d.length} visits.` });
  }
  return out.sort((a, b) => b.daysSince / b.usualGapDays - a.daysSince / a.usualGapDays);
}
const cashNeededForDues = ({ supplierDue = 0, expectedExpenses = 0 }) => ({ rupees: int(supplierDue) + int(expectedExpenses), currency: 'INR', estimate: true, reason: `Supplier dues ${int(supplierDue)} plus usual expenses ${int(expectedExpenses)}.` });

// ---- marketing suggestions (suggest only; WhatsApp sending needs approved templates and the owner's switch) ----
// festivals: owner-entered [{ name, date:'YYYY-MM-DD' }]; we do not guess dates. Suggest an offer from 10 days before.
function festivalIdeas(festivals, today, ahead = 10) {
  return (festivals || []).filter((f) => f && valid(f.date) && valid(today) && days(today, f.date) >= 0 && days(today, f.date) <= ahead)
    .map((f) => ({ name: f.name, inDays: days(today, f.date), text: `${f.name} is in ${days(today, f.date)} day(s). Put a festival offer on your fast-moving items and tell your regulars.`, reason: 'You added this date; offers sell best in the days just before.' })).sort((a, b) => a.inDays - b.inDays);
}
// Review request: customers with a bill in the last 2 days, not do-not-contact. One name list, no text (template wording is fixed elsewhere).
function reviewRequests(customers, today) {
  return (customers || []).filter((c) => c && !c.doNotContact && valid(c.lastBillDay) && days(c.lastBillDay, today) >= 0 && days(c.lastBillDay, today) <= 2).map((c) => ({ customerId: c.customerId, name: c.name, reason: 'Bought in the last two days.' }));
}
module.exports = { salesBy, nextMonthRange, busySlow, lapseRisk, cashNeededForDues, festivalIdeas, reviewRequests };
