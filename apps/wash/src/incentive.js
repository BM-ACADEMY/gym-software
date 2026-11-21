'use strict';
// Attendant incentive per delivered job, whole rupees. Rule: { type: 'flat'|'percent', value }. Class override wins over default.
// A cancelled job earns nothing. Never more than the job total.
const ok = (r) => r && (r.type === 'flat' || r.type === 'percent') && Number.isFinite(r.value) && r.value >= 0 && (r.type !== 'percent' || r.value <= 100);
const incentiveFor = (job, rules) => {
  if (!job || job.state !== 'delivered' || !Number.isInteger(job.total) || job.total < 0) return 0;
  const r = [rules && rules.byClass && rules.byClass[job.klass], rules && rules.default].find(ok);
  if (!r) return 0;
  const v = r.type === 'percent' ? Math.round((job.total * r.value) / 100) : Math.round(r.value);
  return Math.min(v, job.total);
};
function dayTotals(jobs, rules) {
  const out = {};
  for (const j of jobs || []) {
    if (!j || !j.attendantId || j.state !== 'delivered') continue;
    const e = out[j.attendantId] || (out[j.attendantId] = { jobs: 0, billed: 0, incentive: 0 });
    e.jobs += 1; e.billed += j.total; e.incentive += incentiveFor(j, rules);
  }
  return out;
}
// Attendant ranking: most jobs first, then most billed.
const ranking = (totals) => Object.entries(totals).map(([id, v]) => ({ id, ...v })).sort((a, b) => b.jobs - a.jobs || b.billed - a.billed);
module.exports = { incentiveFor, dayTotals, ranking };
