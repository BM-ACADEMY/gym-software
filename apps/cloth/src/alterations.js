'use strict';
// Alteration and tailoring orders. Status flow is one-way except "cancelled". Dates are 'YYYY-MM-DD' (IST day).
const FLOW = { received: ['in_progress', 'ready', 'cancelled'], in_progress: ['ready', 'cancelled'], ready: ['delivered', 'cancelled'], delivered: [], cancelled: [] };
const STATUSES = Object.keys(FLOW);
const canMove = (from, to) => !!(FLOW[from] && FLOW[from].includes(to));
const isDate = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s + 'T00:00:00Z'));
const dayDiff = (a, b) => Math.round((Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / 86400000);

function validate(o, today) {
  if (!o || typeof o !== 'object') return { error: 'Nothing to save.' };
  const what = String(o.what || '').trim().slice(0, 120); if (what.length < 2) return { error: 'Say what the work is (e.g. shorten sleeves).' };
  if (!isDate(o.readyOn)) return { error: 'Pick the date it will be ready.' };
  if (today && o.readyOn < today) return { error: 'The ready date is in the past.' };
  if (!Number.isInteger(o.charge) || o.charge < 0) return { error: 'The charge must be a whole rupee amount (0 if free).' };
  const advance = o.advance == null ? 0 : o.advance;
  if (!Number.isInteger(advance) || advance < 0 || advance > o.charge) return { error: 'The advance cannot be more than the charge.' };
  return { value: { what, readyOn: o.readyOn, charge: o.charge, advance, currency: 'INR', note: String(o.note || '').trim().slice(0, 200) } };
}
// Open jobs that should have been ready by today, and ready jobs nobody has collected for 7+ days.
function lists(jobs, today, uncollectedDays = 7) {
  const open = (jobs || []).filter((j) => j && (j.status === 'received' || j.status === 'in_progress'));
  const ready = (jobs || []).filter((j) => j && j.status === 'ready');
  return {
    overdue: open.filter((j) => j.readyOn < today).map((j) => ({ id: j.id, what: j.what, lateDays: dayDiff(j.readyOn, today) })).sort((a, b) => b.lateDays - a.lateDays),
    dueToday: open.filter((j) => j.readyOn === today).map((j) => ({ id: j.id, what: j.what })),
    notCollected: ready.filter((j) => j.readyAt && dayDiff(j.readyAt, today) >= uncollectedDays).map((j) => ({ id: j.id, what: j.what, waitingDays: dayDiff(j.readyAt, today), balance: j.charge - (j.advance || 0) })),
  };
}
module.exports = { FLOW, STATUSES, canMove, validate, lists, dayDiff, isDate };
