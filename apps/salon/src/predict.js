'use strict';
// ESTIMATES, not promises (Assumption until checked against real data, PRODUCT_PRINCIPLES section 7.8). Every result says what data it used
// and returns `estimate: true`. When there is too little data it says so instead of guessing. Pure.
const mean = (a) => a.reduce((t, x) => t + x, 0) / a.length;
const sd = (a) => { const m = mean(a); return Math.sqrt(mean(a.map((x) => (x - m) ** 2))); };
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// monthly: { '2026-08': 52000, ... } complete months only (the caller leaves out the month in progress).
function nextMonthRange(monthly) {
  const keys = Object.keys(monthly).sort().slice(-6); const v = keys.map((k) => monthly[k]);
  if (v.length < 3) return { estimate: true, enough: false, reason: 'Need at least 3 full months of bills to estimate next month.', dataUsed: keys };
  const m = mean(v); const s = sd(v);
  return { estimate: true, enough: true, low: Math.max(0, Math.round(m - s)), high: Math.round(m + s), currency: 'INR', dataUsed: keys,
    reason: `Based on your last ${v.length} months (average Rs ${Math.round(m)}). The range is one typical swing either side. It is an estimate, not a promise.` };
}
// visits: [{ date:'YYYY-MM-DD', start: minutes }] done or booked. Needs 20+ visits.
function busyTimes(visits) {
  if (!visits || visits.length < 20) return { estimate: true, enough: false, reason: 'Need at least 20 visits to see busy and slow times.', dataUsed: (visits || []).length };
  const day = Array(7).fill(0), hour = {};
  for (const v of visits) { day[new Date(v.date + 'T00:00:00Z').getUTCDay()] += 1; const h = Math.floor(v.start / 60); hour[h] = (hour[h] || 0) + 1; }
  const days = day.map((n, i) => ({ day: DAYS[i], visits: n })).filter((d) => d.visits > 0).sort((a, b) => b.visits - a.visits);
  const hrs = Object.entries(hour).map(([h, n]) => ({ hour: Number(h), visits: n })).sort((a, b) => b.visits - a.visits);
  return { estimate: true, enough: true, busiestDays: days.slice(0, 2), slowestDays: days.slice(-2).reverse(), busiestHours: hrs.slice(0, 3), slowestHours: hrs.slice(-3).reverse(), dataUsed: visits.length, reason: `From your ${visits.length} visits. Busy days are good for upselling; use slow ones for offers.` };
}
// history: { customerId: ['YYYY-MM-DD', ...] } visit dates. A customer with 3+ visits whose current gap is over 1.5x their own average gap may be drifting.
function lapseRisk({ history, today, names = {}, doNotContact = {} }) {
  const out = [];
  for (const [id, dates] of Object.entries(history || {})) {
    const d = [...new Set(dates)].sort(); if (d.length < 3 || doNotContact[id]) continue;
    const gaps = []; for (let i = 1; i < d.length; i++) gaps.push((Date.parse(d[i]) - Date.parse(d[i - 1])) / 86400000);
    const avg = mean(gaps); const since = (Date.parse(today) - Date.parse(d[d.length - 1])) / 86400000;
    if (since > avg * 1.5 && since >= 14) out.push({ id, name: names[id] || '', daysSince: Math.round(since), usualGapDays: Math.round(avg), estimate: true, reason: `Usually comes every ${Math.round(avg)} days; it has been ${Math.round(since)}.` });
  }
  return out.sort((a, b) => b.daysSince / b.usualGapDays - a.daysSince / a.usualGapDays).slice(0, 50);
}
// Cash to keep aside for supplier dues falling due in the next N days (sum of unpaid expenses with a due date).
const cashNeeded = (dues, today, days = 14) => { const end = new Date(Date.parse(today) + days * 86400000).toISOString().slice(0, 10); const rows = (dues || []).filter((d) => d.dueDate && d.dueDate <= end); return { estimate: false, amount: rows.reduce((t, d) => t + d.amount, 0), count: rows.length, currency: 'INR', reason: `Unpaid expenses due by ${end}.` }; };
module.exports = { nextMonthRange, busyTimes, lapseRisk, cashNeeded };
