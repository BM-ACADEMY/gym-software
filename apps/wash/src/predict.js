'use strict';
// Estimates, always labelled as estimates, always with the reason and the data used. Never a promise. Assumption until
// checked against real wash data (first pilot). Pure.
const LABEL = 'Estimate, not a promise';

// Next month's sales range from up to the last 6 whole months (oldest first). Needs 3 months; else no number.
function nextMonthRange(monthlyTotals) {
  const t = (monthlyTotals || []).filter((n) => Number.isInteger(n) && n >= 0).slice(-6);
  if (t.length < 3) return { label: LABEL, enough: false, reason: 'Needs at least 3 months of sales. Keep billing and this will appear.' };
  const mean = t.reduce((s, n) => s + n, 0) / t.length;
  const lo = Math.min(...t), hi = Math.max(...t);
  return { label: LABEL, enough: true, low: Math.round(lo), expected: Math.round(mean), high: Math.round(hi), currency: 'INR', basedOn: t, reason: `Your last ${t.length} months were between Rs ${lo} and Rs ${hi}, averaging Rs ${Math.round(mean)}.` };
}
// Busiest and slowest hours: count of jobs created per hour (IST) over the given jobs. Needs 20 jobs.
function busyHours(jobs, hourOf) {
  const list = (jobs || []).filter((j) => j.createdAt);
  if (list.length < 20) return { label: LABEL, enough: false, reason: 'Needs about 20 jobs to see a pattern.' };
  const c = {}; for (const j of list) { const h = hourOf(j.createdAt); c[h] = (c[h] || 0) + 1; }
  const rows = Object.entries(c).map(([h, n]) => ({ hour: Number(h), jobs: n })).sort((a, b) => b.jobs - a.jobs);
  return { label: LABEL, enough: true, busiest: rows.slice(0, 3), slowest: rows.slice(-3).reverse(), basedOn: list.length, reason: `From ${list.length} past jobs.` };
}
// Monthly passes ending within 14 days, and a rough rupee value if half renew (Assumption: 50 percent until measured).
function renewalsExpected(passes, today, status) {
  const soon = (passes || []).map((p) => ({ p, s: status(p, today) })).filter((x) => !x.s.expired && x.s.daysLeft <= 14);
  const value = soon.reduce((s, x) => s + (x.p.price || 0), 0);
  return { label: LABEL, count: soon.length, ifAllRenew: value, ifHalfRenew: Math.round(value / 2), currency: 'INR', reason: `${soon.length} pass${soon.length === 1 ? '' : 'es'} end in 14 days. The 50 percent figure is a guess until real renewals are counted.` };
}
// Customers likely to lapse: now more than twice their own wash gap away but under 60 days (so not already lost).
const DAY = 86400000;
function lapseRisk(vehicles, today, defaultGap = 14) {
  const d = (a) => Math.round((Date.parse(today + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / DAY);
  return (vehicles || []).filter((v) => v && !v.doNotContact && /^\d{4}-\d{2}-\d{2}$/.test(v.lastWash || '')).map((v) => ({ plate: v.plate, name: v.ownerName, away: d(v.lastWash), gap: Number.isInteger(v.intervalDays) ? v.intervalDays : defaultGap }))
    .filter((x) => x.away > 2 * x.gap && x.away < 60).map((x) => ({ ...x, label: LABEL, reason: `Usually washes every ${x.gap} days, now ${x.away} days away` })).sort((a, b) => b.away / b.gap - a.away / a.gap);
}
module.exports = { LABEL, nextMonthRange, busyHours, renewalsExpected, lapseRisk };
