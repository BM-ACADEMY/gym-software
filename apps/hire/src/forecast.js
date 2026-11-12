'use strict';
// Estimates for the agency: how long jobs take to fill, and fees that may come from open submissions. Pure.
// These are ESTIMATES. The stage chances are our starting guesses (assumptions), not measured facts: the agency should replace them with its own history.
const STAGE_CHANCE = { submitted: 0.1, interview: 0.25, offer: 0.7 }; // assumption, not a source
const SAMPLE_MIN = 3; // below this we say there is not enough history
const median = (a) => { const s = [...a].sort((x, y) => x - y); const m = Math.floor(s.length / 2); return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2); };
// Days from the job being opened (createdAt) to each candidate joining.
function timeToFill({ jobs = [], entries = [] }) {
  const open = new Map(jobs.map((j) => [String(j.id || j._id), j.createdAt])); const days = [];
  for (const e of entries) {
    const j = open.get(String(e.jobId)); const joined = (e.history || []).filter((h) => h.to === 'joined').pop(); if (!j || !joined) continue;
    const d = Math.round((new Date(joined.at) - new Date(j)) / 864e5); if (d >= 0 && d < 1000) days.push(d);
  }
  if (days.length < SAMPLE_MIN) return { enough: false, samples: days.length, note: `Not enough history yet. Needs ${SAMPLE_MIN} placements; you have ${days.length}.` };
  return { enough: true, samples: days.length, medianDays: median(days), fastestDays: Math.min(...days), slowestDays: Math.max(...days), estimate: true, note: 'Estimate from your own placements. Real time depends on the role and client.' };
}
// Fee that could come from entries still open. fee = rate x pay. Pay is the offered pay, else the job's maximum pay.
function feeForecast({ entries = [], jobs = [], clients = [], chances = STAGE_CHANCE }) {
  const J = new Map(jobs.map((j) => [String(j.id || j._id), j])); const C = new Map(clients.map((c) => [String(c.id || c._id), c]));
  let expected = 0; let counted = 0; let skipped = 0; const byStage = {};
  for (const e of entries) {
    const p = chances[e.stage]; if (!p) continue; const j = J.get(String(e.jobId)); const c = j && j.clientId ? C.get(String(j.clientId)) : null; const pay = Number.isInteger(e.offeredCtc) ? e.offeredCtc : j && j.maxCtc;
    if (!c || !Number.isInteger(pay) || pay <= 0 || !Number.isFinite(c.feeValue)) { skipped++; continue; }
    const fee = c.feeType === 'flat' ? Math.round(c.feeValue) : Math.round(pay * c.feeValue / 100); const v = Math.round(fee * p);
    expected += v; counted++; byStage[e.stage] = (byStage[e.stage] || 0) + v;
  }
  return { expectedFee: expected, currency: 'INR', counted, skipped, byStage, chances, estimate: true, note: 'Estimate. The chances at each stage are starting guesses, not your history. Fee is without GST. Entries with no client fee terms or no pay figure are skipped.' };
}
module.exports = { STAGE_CHANCE, SAMPLE_MIN, timeToFill, feeForecast };
