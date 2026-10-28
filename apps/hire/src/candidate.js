'use strict';
// Candidate identity and duplicate detection. Pure functions.
const err = (code, msg) => Object.assign(new Error(msg), { code });

// Indian mobile to E.164 (+91XXXXXXXXXX). Returns null when it cannot be a mobile number.
function normalizePhone(raw) {
  if (raw == null) return null;
  let d = String(raw).replace(/[^\d]/g, '');
  if (d.length === 12 && d.startsWith('91')) d = d.slice(2);
  else if (d.length === 11 && d.startsWith('0')) d = d.slice(1);
  if (!/^[6-9]\d{9}$/.test(d)) return null;
  return '+91' + d;
}

function normalizeEmail(raw) {
  if (raw == null) return null;
  const e = String(raw).trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) ? e : null;
}

// Match a new candidate against existing ones of the SAME agency only (caller passes that list).
// Phone match is strong; email match is secondary. Never merges by name alone.
function findDuplicate(incoming, existing) {
  const p = normalizePhone(incoming.phone), e = normalizeEmail(incoming.email);
  for (const c of existing || []) {
    if (p && normalizePhone(c.phone) === p) return { match: c, by: 'phone' };
  }
  for (const c of existing || []) {
    if (e && normalizeEmail(c.email) === e) return { match: c, by: 'email' };
  }
  return null;
}

// Merge into history: keep existing non-empty fields, fill gaps from the new data, list what changed.
function mergeCandidate(existing, incoming) {
  const out = { ...existing }; const filled = [];
  for (const k of ['name', 'email', 'currentCompany', 'currentTitle', 'location', 'noticeDays', 'currentCtc', 'expectedCtc', 'experienceYears']) {
    if ((out[k] == null || out[k] === '') && incoming[k] != null && incoming[k] !== '') { out[k] = incoming[k]; filled.push(k); }
  }
  const skills = new Set([...(existing.skills || []), ...(incoming.skills || [])].map((s) => String(s).trim().toLowerCase()).filter(Boolean));
  if (skills.size !== (existing.skills || []).length) filled.push('skills');
  out.skills = [...skills];
  return { candidate: out, filled };
}

module.exports = { normalizePhone, normalizeEmail, findDuplicate, mergeCandidate, err };
