'use strict';
// Candidate consent and retention (DPDP-aware, wording pending lawyer, Tier 3). The retention days are an
// agency setting with a default that is an ASSUMPTION, not a legal rule.
const DAY = 864e5;
const DEFAULT_RETENTION_DAYS = 365;
function consentRecord({ source, at = new Date(), purposeAi = false, noticeVersion }) {
  if (!['candidate_form', 'whatsapp_reply', 'agency_declared'].includes(source)) { const e = new Error('consent source unknown'); e.code = 'CONSENT_SOURCE'; throw e; }
  return { source, at: new Date(at).toISOString(), purposeAi: !!purposeAi, noticeVersion: noticeVersion || null, withdrawnAt: null };
}
function retentionStatus(cand, now = new Date(), days = DEFAULT_RETENTION_DAYS) {
  if (cand.consent && cand.consent.withdrawnAt) return 'delete_now';
  if (!cand.consent) return 'no_consent';
  const base = new Date(cand.lastActivityAt || cand.consent.at).getTime();
  const left = base + days * DAY - new Date(now).getTime();
  return left <= 0 ? 'review_or_delete' : left <= 30 * DAY ? 'due_soon' : 'ok';
}
// WhatsApp outreach is allowed only with consent on file and not withdrawn, or inside a 24h reply window.
function canMessage(cand, now = new Date()) {
  if (cand.doNotContact) return { ok: false, why: 'do_not_contact' };
  if (cand.consent && !cand.consent.withdrawnAt) return { ok: true, why: 'consent' };
  if (cand.lastCandidateMessageAt && new Date(now) - new Date(cand.lastCandidateMessageAt) < DAY) return { ok: true, why: 'reply_window' };
  return { ok: false, why: 'no_consent' };
}
module.exports = { consentRecord, retentionStatus, canMessage, DEFAULT_RETENTION_DAYS };
