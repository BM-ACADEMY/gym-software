'use strict';
// Validates what the AI resume parser returns. The model output is untrusted: we accept only known fields,
// clamp numbers and drop anything else. Recruiter sees every field and can correct it.
const { normalizePhone, normalizeEmail } = require('./candidate');

const num = (v, min, max) => { const n = Number(v); return Number.isFinite(n) && n >= min && n <= max ? n : null; };
const str = (v, max) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null);

function validateParsed(raw) {
  const r = raw && typeof raw === 'object' ? raw : {};
  const skills = Array.isArray(r.skills)
    ? [...new Set(r.skills.map((s) => str(s, 40)).filter(Boolean).map((s) => s.toLowerCase()))].slice(0, 40) : [];
  const cand = {
    name: str(r.name, 120),
    phone: normalizePhone(r.phone),
    email: normalizeEmail(r.email),
    location: str(r.location, 80),
    currentTitle: str(r.currentTitle, 80),
    currentCompany: str(r.currentCompany, 80),
    experienceYears: num(r.experienceYears, 0, 60),
    noticeDays: num(r.noticeDays, 0, 365),
    currentCtc: num(r.currentCtc, 0, 1e9),   // whole rupees a year
    expectedCtc: num(r.expectedCtc, 0, 1e9), // whole rupees a year
    currency: 'INR',
    skills,
  };
  // Fields the recruiter must check before the record counts as reviewed.
  const missing = ['name', 'phone'].filter((k) => !cand[k]);
  return { candidate: cand, missing, needsReview: missing.length > 0 || skills.length === 0 };
}

module.exports = { validateParsed };
