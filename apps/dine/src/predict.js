'use strict';
// Predictions (area 8). EVERY result is an estimate and says so, shows the data it used and the reason. Never a promise.
// Assumption until checked against real data: simple averages are good enough for a small place. Thresholds can change.
const LABEL = 'Estimate from your own past sales. It is not a promise.';
const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
const sd = (a) => { const m = mean(a); return Math.sqrt(mean(a.map((x) => (x - m) ** 2))); };

// Next month's sales range from the last full months (oldest first). Needs 3 months. Range = average of the last 3 months +/- one spread, at least 10 percent either side.
function salesRange(monthTotals) {
  if (!Array.isArray(monthTotals) || monthTotals.length < 3) return { label: LABEL, range: null, reason: 'Needs at least 3 full months of sales. You have ' + (monthTotals || []).length + '.', basedOn: monthTotals || [] };
  const last = monthTotals.slice(-3); const m = mean(last); const spread = Math.max(sd(last), m * 0.1);
  return { label: LABEL, range: { low: Math.max(0, Math.round(m - spread)), mid: Math.round(m), high: Math.round(m + spread) }, currency: 'INR', basedOn: last, reason: 'Average of your last 3 months is Rs ' + Math.round(m) + '. The range allows for the usual ups and downs.' };
}
// Busy and slow weekdays from daily sales [{ date, sales }] (needs 14 days). Weekday 0 = Sunday.
function busyDays(daily) {
  if (!daily || daily.length < 14) return { label: LABEL, days: null, reason: 'Needs at least 14 days of sales.' };
  const sums = Array(7).fill(0); const n = Array(7).fill(0);
  for (const d of daily) { const w = new Date(d.date + 'T00:00:00Z').getUTCDay(); sums[w] += d.sales; n[w] += 1; }
  const avg = sums.map((s, i) => (n[i] ? Math.round(s / n[i]) : null));
  const have = avg.map((v, i) => [i, v]).filter((x) => x[1] !== null).sort((a, b) => b[1] - a[1]);
  return { label: LABEL, averages: avg, busiest: have[0][0], slowest: have[have.length - 1][0], reason: 'Based on ' + daily.length + ' days: your best weekday averages Rs ' + have[0][1] + ' and your slowest Rs ' + have[have.length - 1][1] + '.' };
}
// Busy hours from byHour rows over several days: the top 3 and bottom 3 open hours.
function busyHours(byHour) {
  const open = (byHour || []).filter((h) => h.sales > 0).sort((a, b) => b.sales - a.sales);
  if (open.length < 6) return { label: LABEL, busiest: null, reason: 'Needs sales in at least 6 different hours.' };
  return { label: LABEL, busiest: open.slice(0, 3).map((h) => h.hour).sort((a, b) => a - b), slowest: open.slice(-3).map((h) => h.hour).sort((a, b) => a - b), reason: 'Based on the hours you have sold in so far.' };
}
// Stock that will run out. stock: [{ id, name, qty }], dailyUse: { id: perDay } (average of recent days). Runs out in N days = qty / use.
function stockRunOut(stock, dailyUse, withinDays = 3) {
  return stock.filter((s) => dailyUse[s.id] > 0).map((s) => ({ id: s.id, name: s.name, daysLeft: Math.floor(s.qty / dailyUse[s.id]), qty: s.qty, perDay: Math.round(dailyUse[s.id] * 100) / 100 }))
    .filter((s) => s.daysLeft <= withinDays).sort((a, b) => a.daysLeft - b.daysLeft)
    .map((s) => ({ ...s, label: LABEL, reason: s.name + ': ' + s.qty + ' left and you use about ' + s.perDay + ' a day, so it may run out in about ' + s.daysLeft + ' day(s).' }));
}
// Regulars likely to lapse: 3 or more visits, and the gap since the last visit is more than 1.5 times their own usual gap. visits: ['YYYY-MM-DD', ...]
function lapseRisk(customers, today) {
  const out = [];
  for (const c of customers) {
    if (c.doNotContact) continue;
    const v = [...(c.visits || [])].sort();
    if (v.length < 3) continue;
    const gaps = []; for (let i = 1; i < v.length; i++) gaps.push((Date.parse(v[i]) - Date.parse(v[i - 1])) / 86400000);
    const usual = mean(gaps); const since = (Date.parse(today) - Date.parse(v[v.length - 1])) / 86400000;
    if (usual > 0 && since > usual * 1.5) out.push({ id: c.id, name: c.name, usualGapDays: Math.round(usual), daysSince: Math.round(since), label: LABEL, reason: c.name + ' usually comes every ' + Math.round(usual) + ' days and it has been ' + Math.round(since) + '.' });
  }
  return out.sort((a, b) => b.daysSince / b.usualGapDays - a.daysSince / a.usualGapDays);
}
// Cash needed in the next N days for supplier dues: rows [{ supplier, due, dueDate }] -> total and list.
function cashNeeded(dues, today, days = 7) {
  const lim = Date.parse(today) + days * 86400000;
  const rows = dues.filter((d) => d.dueDate && Date.parse(d.dueDate) <= lim);
  return { label: LABEL, total: rows.reduce((a, d) => a + d.due, 0), rows, currency: 'INR', reason: rows.length + ' supplier payment(s) fall due in the next ' + days + ' days.' };
}
module.exports = { LABEL, salesRange, busyDays, busyHours, stockRunOut, lapseRisk, cashNeeded };
