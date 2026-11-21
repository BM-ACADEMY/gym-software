'use strict';
// Data export and delete on request (DPDP style rights; the lawyer still reviews the wording, M-15).
// Pure: no database. The routes in routes.js use these so what leaves, and what is wiped, is decided in one place.
// Anonymise, not hard delete, because the agency still needs its placement and fee records (money must add up).
const PERSONAL = ['name', 'phone', 'email', 'location', 'currentTitle', 'currentCompany'];
const EXPORT_FIELDS = ['name', 'phone', 'email', 'location', 'currentTitle', 'currentCompany', 'experienceYears', 'noticeDays', 'currentCtc', 'expectedCtc', 'currency', 'skills', 'source', 'doNotContact', 'createdAt'];
const pick = (o, keys) => keys.reduce((a, k) => (o && o[k] !== undefined && o[k] !== null ? { ...a, [k]: o[k] } : a), {});

// Everything we hold about one candidate, in plain fields. No internal ids, no link hashes, no scores the agency computed.
function candidateExport(c, entries = []) {
  const consent = c.consent ? { source: c.consent.source || null, at: c.consent.at || null, purposeAi: !!c.consent.purposeAi, noticeVersion: c.consent.noticeVersion || null, withdrawnAt: c.consent.withdrawnAt || null } : null;
  return {
    exportedAt: new Date().toISOString(), kind: 'candidate_data', candidate: pick(c, EXPORT_FIELDS), consent,
    applications: entries.map((e) => ({ stage: e.stage || null, stageAt: e.stageAt || null, history: Array.isArray(e.history) ? e.history.map((h) => pick(h, ['stage', 'at'])) : [] })),
  };
}
// The $set / $unset that wipes the person but keeps the row, so the agency's counts and fees stay correct.
// hasConsent: setting consent.withdrawnAt when the candidate has no consent object would make the database refuse the update.
function anonymiseUpdate(now = new Date(), hasConsent = false) {
  const set = { name: 'Removed on request', skills: [], experienceYears: null, noticeDays: null, currentCtc: null, expectedCtc: null, source: 'removed', reviewed: true, doNotContact: true, anonymisedAt: now, ...(hasConsent ? { 'consent.withdrawnAt': now } : {}), consentLinkExpires: null, consentLinkUsedAt: null, lastCandidateMessageAt: null };
  const unset = { phone: '', email: '', location: '', currentTitle: '', currentCompany: '', consentLinkHash: '' };
  return { $set: set, $unset: unset };
}
const isAnonymised = (c) => !!(c && c.anonymisedAt);

// Whole-agency export for the owner. Row caps keep one request small; the response says when a list was cut.
const CAP = 5000;
function agencyExport({ tenant, candidates = [], clients = [], jobs = [], entries = [], fees = [] }) {
  const cut = (a) => (a.length > CAP ? a.slice(0, CAP) : a);
  const lists = { candidates, clients, jobs, entries, fees };
  return {
    exportedAt: new Date().toISOString(), kind: 'agency_data', currency: 'INR', agency: pick(tenant || {}, ['agencyName', 'state', 'createdAt']),
    candidates: cut(candidates).map((c) => pick(c, EXPORT_FIELDS)),
    clients: cut(clients).map((c) => pick(c, ['name', 'contactName', 'feeType', 'feeValue', 'guaranteeDays'])),
    jobs: cut(jobs).map((j) => pick(j, ['title', 'location', 'openings', 'status', 'mustSkills', 'niceSkills', 'minExperience', 'maxExperience', 'maxCtc', 'maxNoticeDays'])),
    entries: cut(entries).map((e) => pick(e, ['stage', 'stageAt', 'clientDecision', 'offeredCtc', 'note'])),
    fees: cut(fees).map((f) => pick(f, ['fee', 'gst', 'total', 'currency', 'issuedAt', 'dueDate', 'paidAt'])),
    truncated: Object.keys(lists).filter((k) => lists[k].length > CAP),
  };
}
// One audit line: who did what to which record. Never the personal details themselves.
const auditEntry = (req, action, ref) => ({ who: String((req.user && (req.user.email || req.user.id)) || 'unknown').slice(0, 80), action: String(action).slice(0, 40), ref: ref ? String(ref).slice(0, 60) : undefined });
module.exports = { PERSONAL, EXPORT_FIELDS, candidateExport, anonymiseUpdate, isAnonymised, agencyExport, auditEntry, CAP };
