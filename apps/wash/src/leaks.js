'use strict';
// Leak checks for the owner (D-30): staff discounts and voided jobs, grouped per day. Whole rupees, INR. Pure; suggestions only.
// A void here is a job cancelled after the wash had started (work was done or water and chemicals used).
const staffDiscounts = (jobs) => {
  const m = {};
  for (const j of jobs || []) {
    if (!j || j.discountBy !== 'staff' || !(j.discount > 0) || j.state === 'cancelled') continue;
    const e = m[j.day] || (m[j.day] = { date: j.day, count: 0, total: 0, currency: 'INR' }); e.count += 1; e.total += j.discount;
  }
  return Object.values(m).sort((a, b) => b.date.localeCompare(a.date));
};
const voids = (jobs) => {
  const m = {};
  for (const j of jobs || []) {
    if (!j || j.state !== 'cancelled' || !j.startedAt) continue;
    const e = m[j.day] || (m[j.day] = { date: j.day, count: 0, total: 0, currency: 'INR' }); e.count += 1; e.total += j.total || 0;
  }
  return Object.values(m).sort((a, b) => b.date.localeCompare(a.date));
};
function leakList({ jobs }) {
  const out = [];
  for (const d of staffDiscounts(jobs)) out.push({ date: d.date, key: 'staffDiscounts', text: `On ${d.date} staff gave ${d.count} discount${d.count > 1 ? 's' : ''} worth Rs ${d.total}`, rupees: d.total });
  for (const d of voids(jobs)) out.push({ date: d.date, key: 'voids', text: `On ${d.date} ${d.count} started job${d.count > 1 ? 's were' : ' was'} cancelled, worth Rs ${d.total}`, rupees: d.total });
  return out.sort((a, b) => b.date.localeCompare(a.date));
}
module.exports = { staffDiscounts, voids, leakList };
