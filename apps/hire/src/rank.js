'use strict';
// Deterministic ranking baseline. The AI only adds a short written reason AFTER this score exists,
// and can never change the number. Recruiter can override the order.
const norm = (s) => String(s || '').trim().toLowerCase();

function score(job, cand) {
  const must = (job.mustSkills || []).map(norm), nice = (job.niceSkills || []).map(norm);
  const has = new Set((cand.skills || []).map(norm));
  const parts = []; let total = 0;

  const mustHit = must.filter((s) => has.has(s)), mustMiss = must.filter((s) => !has.has(s));
  const mustPts = must.length ? Math.round(50 * mustHit.length / must.length) : 50;
  total += mustPts; parts.push({ rule: 'must_skills', points: mustPts, max: 50, hit: mustHit, missing: mustMiss });

  const nicePts = nice.length ? Math.round(10 * nice.filter((s) => has.has(s)).length / nice.length) : 0;
  total += nicePts; parts.push({ rule: 'nice_skills', points: nicePts, max: 10 });

  let expPts = 0;
  if (cand.experienceYears != null) {
    const lo = job.minExperience ?? 0, hi = job.maxExperience ?? 99;
    expPts = cand.experienceYears >= lo && cand.experienceYears <= hi ? 20 : cand.experienceYears >= lo - 1 && cand.experienceYears <= hi + 1 ? 10 : 0;
  }
  total += expPts; parts.push({ rule: 'experience', points: expPts, max: 20 });

  let payPts = 0;
  if (cand.expectedCtc != null && job.maxCtc != null) payPts = cand.expectedCtc <= job.maxCtc ? 10 : cand.expectedCtc <= job.maxCtc * 1.1 ? 5 : 0;
  else if (job.maxCtc == null) payPts = 5;
  total += payPts; parts.push({ rule: 'pay_fit', points: payPts, max: 10 });

  let locPts = 0;
  if (job.location && cand.location) locPts = norm(job.location) === norm(cand.location) ? 5 : 0;
  total += locPts; parts.push({ rule: 'location', points: locPts, max: 5 });

  let noticePts = 0;
  if (cand.noticeDays != null) noticePts = cand.noticeDays <= (job.maxNoticeDays ?? 60) ? 5 : 0;
  total += noticePts; parts.push({ rule: 'notice', points: noticePts, max: 5 });

  return { score: total, parts };
}

function rankCandidates(job, cands) {
  return (cands || []).map((c) => ({ candidateId: c.id, ...score(job, c) }))
    .sort((a, b) => b.score - a.score || String(a.candidateId).localeCompare(String(b.candidateId)));
}

// Only the numbers and rule names go to the model for the reason: no name, phone or email (D-15 pattern).
function reasonInput(job, ranked) {
  return { role: job.title, score: ranked.score, parts: ranked.parts.map(({ rule, points, max, hit, missing }) => ({ rule, points, max, hit, missing })) };
}

module.exports = { score, rankCandidates, reasonInput };
