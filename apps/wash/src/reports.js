'use strict';
// Sales reports from delivered jobs: by day, vehicle class, attendant or hour of day (IST). Whole rupees. Pure.
// Refunds are subtracted (WSH-10): each row has revenue (what the jobs came to), refunded and net (revenue minus refunds).
//   by day:  a refund counts on the day the money went back (same as the cash book and the profit and loss).
//   others:  a refund counts against the original job's class, attendant or hour. jobsById: { jobId: job } for refunds in range.
// A refund whose job cannot be found is listed in unplacedRefunds, not hidden.
const hourIST = (d) => new Date(new Date(d).getTime() + 5.5 * 3600000).getUTCHours();
const keyOf = (j, by) => (by === 'day' ? j.day : by === 'class' ? j.klass : by === 'attendant' ? String(j.attendantId || 'none') : by === 'hour' ? String(hourIST(j.deliveredAt || j.createdAt)) : null);
function salesBy(jobs, by, refunds = [], jobsById = {}) {
  const out = {}; const row = (k) => out[k] || (out[k] = { key: k, jobs: 0, revenue: 0, refunded: 0, net: 0 });
  for (const j of jobs || []) {
    if (j.state !== 'delivered') continue;
    const k = keyOf(j, by); if (k === null || k === undefined) return { error: 'Choose day, class, attendant or hour' };
    const e = row(k); e.jobs += 1; e.revenue += j.total || 0;
  }
  if (!['day', 'class', 'attendant', 'hour'].includes(by)) return { error: 'Choose day, class, attendant or hour' };
  let unplaced = 0;
  for (const r of refunds || []) {
    const amount = Math.round(Number(r.amount) || 0); if (amount <= 0) continue;
    const k = by === 'day' ? r.day : (jobsById[String(r.jobId)] ? keyOf(jobsById[String(r.jobId)], by) : null);
    if (k === null || k === undefined) { unplaced += amount; continue; }
    row(k).refunded += amount;
  }
  const rows = Object.values(out).map((e) => ({ ...e, net: e.revenue - e.refunded })).sort((a, b) => (by === 'day' || by === 'hour' ? (by === 'hour' ? Number(a.key) - Number(b.key) : a.key.localeCompare(b.key)) : b.net - a.net));
  const revenue = rows.reduce((s, r) => s + r.revenue, 0); const refunded = rows.reduce((s, r) => s + r.refunded, 0);
  return { rows, total: revenue, refundedTotal: refunded, netTotal: revenue - refunded, unplacedRefunds: unplaced, currency: 'INR' };
}
module.exports = { salesBy, hourIST };
