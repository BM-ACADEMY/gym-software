'use strict';
// Estimates. Every result says it is an estimate, shows the data it used and why. Never a promise. Assumption until checked on real shops.
const avg = (a) => a.reduce((x, y) => x + y, 0) / a.length;
const sd = (a) => { const m = avg(a); return Math.sqrt(avg(a.map((x) => (x - m) ** 2))); };

// monthly: [{month:'2026-09', total}] oldest first. Needs 3+ full months; uses the last 6. Range = average +/- one standard deviation.
function nextMonthRange(monthly) {
  const m = (monthly || []).filter((x) => Number.isInteger(x.total) && x.total >= 0).slice(-6);
  if (m.length < 3) return null;
  const t = m.map((x) => x.total), a = avg(t), s = sd(t);
  return { low: Math.max(0, Math.round(a - s)), likely: Math.round(a), high: Math.round(a + s), months: m.length, currency: 'INR', estimate: true, reason: `Based on your last ${m.length} months (average Rs ${Math.round(a)}). Festivals and weather can change this.` };
}
// daily: [{date,total}] — needs 28+ days. Busiest and slowest weekday by average takings.
function weekdayPattern(daily) {
  const d = (daily || []).filter((x) => Number.isInteger(x.total)); if (d.length < 28) return null;
  const sums = Array(7).fill(0), n = Array(7).fill(0);
  for (const x of d) { const w = new Date(x.date + 'T00:00:00Z').getUTCDay(); sums[w] += x.total; n[w] += 1; }
  const names = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const avgs = sums.map((s, i) => (n[i] ? s / n[i] : null)).map((v, i) => ({ day: names[i], avg: v === null ? null : Math.round(v) })).filter((x) => x.avg !== null).sort((a, b) => b.avg - a.avg);
  return { busiest: avgs[0], slowest: avgs[avgs.length - 1], days: d.length, estimate: true, reason: `Average takings by weekday over ${d.length} days.` };
}
// Stock that will run out: variants [{key,qty}] and units sold in the last 30 days per key. Lists those under `withinDays` of cover.
function runOut(variants, soldLast30, withinDays = 14) {
  const out = [];
  for (const v of variants || []) {
    const sold = (soldLast30 || {})[v.key] || 0; if (sold <= 0 || !(v.qty >= 0)) continue;
    const days = Math.floor(v.qty / (sold / 30)); if (days <= withinDays) out.push({ key: v.key, qty: v.qty, daysLeft: days, estimate: true, reason: `Sold ${sold} in 30 days; ${v.qty} left lasts about ${days} days.` });
  }
  return out.sort((a, b) => a.daysLeft - b.daysLeft);
}
// Lapse risk: a customer with 3+ visits whose current gap is over 1.5 x their own average gap. visits: ['YYYY-MM-DD',...]
function lapseRisk(customers, today) {
  const t = Date.parse(today + 'T00:00:00Z'); const out = [];
  for (const c of customers || []) {
    if (c.doNotContact) continue; const v = [...new Set(c.visits || [])].sort(); if (v.length < 3) continue;
    const gaps = []; for (let i = 1; i < v.length; i++) gaps.push((Date.parse(v[i] + 'T00:00:00Z') - Date.parse(v[i - 1] + 'T00:00:00Z')) / 86400000);
    const g = avg(gaps), since = Math.round((t - Date.parse(v[v.length - 1] + 'T00:00:00Z')) / 86400000);
    if (since > g * 1.5) out.push({ id: c.id, name: c.name, usualGapDays: Math.round(g), daysSince: since, estimate: true, reason: `Usually comes every ${Math.round(g)} days; it has been ${since}.` });
  }
  return out.sort((a, b) => (b.daysSince / b.usualGapDays) - (a.daysSince / a.usualGapDays));
}
// Cash you will need for supplier bills due within N days plus salaries you enter.
function cashNeeded(supplierRows, salaries, within = 7) {
  const sup = (supplierRows || []).filter((r) => r.dueIn <= within).reduce((a, r) => a + r.owe, 0);
  return { suppliers: sup, salaries: salaries || 0, total: sup + (salaries || 0), currency: 'INR', estimate: true, reason: `Supplier bills due in ${within} days plus the salaries you entered.` };
}
module.exports = { nextMonthRange, weekdayPattern, runOut, lapseRisk, cashNeeded };
