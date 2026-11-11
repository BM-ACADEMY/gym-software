'use strict';
// Sales reports from delivered jobs: by day, vehicle class, attendant or hour of day (IST). Whole rupees. Pure.
const hourIST = (d) => new Date(new Date(d).getTime() + 5.5 * 3600000).getUTCHours();
function salesBy(jobs, by) {
  const out = {};
  for (const j of jobs || []) {
    if (j.state !== 'delivered') continue;
    const k = by === 'day' ? j.day : by === 'class' ? j.klass : by === 'attendant' ? String(j.attendantId || 'none') : by === 'hour' ? String(hourIST(j.deliveredAt || j.createdAt)) : null;
    if (k === null || k === undefined) return { error: 'Choose day, class, attendant or hour' };
    const e = out[k] || (out[k] = { key: k, jobs: 0, revenue: 0 }); e.jobs += 1; e.revenue += j.total || 0;
  }
  const rows = Object.values(out).sort((a, b) => (by === 'day' || by === 'hour' ? (by === 'hour' ? Number(a.key) - Number(b.key) : a.key.localeCompare(b.key)) : b.revenue - a.revenue));
  return { rows, total: rows.reduce((s, r) => s + r.revenue, 0), currency: 'INR' };
}
module.exports = { salesBy, hourIST };
