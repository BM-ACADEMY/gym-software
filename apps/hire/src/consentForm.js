'use strict';
// Candidate consent form (DPDP-aware). The agency creates a one-time link for a candidate; the candidate opens it, reads the notice,
// and agrees (and separately says yes or no to AI reading of the resume). Link = 192-bit secret, stored only as a hash, 7 days, used once.
// The form does NOT work until HIRE_CONSENT_NOTICE_VERSION is set, which is done only after the lawyer's written approval is filed (M-15).
// The page shows the agency name and the notice only: no candidate data of any kind.
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { consentRecord } = require('./consent');
const { runWithTenant, runUnscoped } = require('../../../packages/core-server/src');
const makeModels = require('./models');
const DAY = 864e5, LINK_DAYS = 7;
const hash = (t) => crypto.createHash('sha256').update(String(t)).digest('hex');
const newToken = () => crypto.randomBytes(24).toString('hex'); // 48 hex characters
const validToken = (t) => typeof t === 'string' && /^[0-9a-f]{48}$/.test(t);

function noticeFor(agencyName, file = path.join(__dirname, '..', 'notice', 'consent-notice.txt')) {
  const raw = fs.readFileSync(file, 'utf8');
  return raw.replace(/\{agency\}/g, String(agencyName || 'The agency').slice(0, 120)).split('\n').filter((l) => !/^DRAFT\./.test(l)).join('\n').trim();
}
// An approved notice has no DRAFT marker in the file; a file that still says DRAFT is never served.
const isDraft = (file = path.join(__dirname, '..', 'notice', 'consent-notice.txt')) => /^DRAFT\./m.test(fs.readFileSync(file, 'utf8'));

function linkState(c, now = new Date()) {
  if (!c || !c.consentLinkHash) return 'none';
  if (c.consentLinkUsedAt) return 'used';
  if (!c.consentLinkExpires || new Date(c.consentLinkExpires) <= now) return 'expired';
  return 'open';
}
// What the candidate's answer does to the record. Agreement must be an explicit true; AI is a separate explicit true.
function applyAnswer(body, { version, now = new Date() }) {
  if (!body || body.agree !== true) { const e = new Error('Please tick the box to agree.'); e.code = 'CONSENT_NOT_AGREED'; throw e; }
  return { consent: consentRecord({ source: 'candidate_form', at: now, purposeAi: body.purposeAi === true, noticeVersion: version }), doNotContact: false };
}

// env: { HIRE_CONSENT_NOTICE_VERSION }. store: { findByHash(h) -> {candidate, agencyName}|null, issue(candidateId, tenantId, hash, expires), save(candidate, patch) }
function createConsentFormRouter({ express, store, env = process.env, now = () => new Date(), noticeFile }) {
  const router = express.Router();
  const closed = (res) => res.status(503).json({ success: false, message: 'This form is not open yet.' });
  const live = () => Boolean(env.HIRE_CONSENT_NOTICE_VERSION) && !isDraft(noticeFile);
  const lookup = async (token) => (validToken(token) ? store.findByHash(hash(token)) : null);
  router.get('/:token', async (req, res) => {
    try {
      if (!live()) return closed(res);
      const f = await lookup(req.params.token); const st = f ? linkState(f.candidate, now()) : 'none';
      if (st !== 'open') return res.status(st === 'none' ? 404 : 410).json({ success: false, message: st === 'used' ? 'This form was already answered.' : st === 'expired' ? 'This link has expired. Please ask the agency for a new one.' : 'This link is not valid.' });
      res.json({ success: true, data: { agency: f.agencyName, notice: noticeFor(f.agencyName, noticeFile), version: env.HIRE_CONSENT_NOTICE_VERSION } });
    } catch (e) { console.error('consent form failed:', e.message); res.status(500).json({ success: false, message: 'Server error' }); }
  });
  router.post('/:token', async (req, res) => {
    try {
      if (!live()) return closed(res);
      const f = await lookup(req.params.token);
      if (!f) return res.status(404).json({ success: false, message: 'This link is not valid.' });
      const st = linkState(f.candidate, now()); if (st !== 'open') return res.status(410).json({ success: false, message: 'This link is no longer open.' });
      let patch; try { patch = applyAnswer(req.body, { version: env.HIRE_CONSENT_NOTICE_VERSION, now: now() }); } catch (e) { if (e.code === 'CONSENT_NOT_AGREED') return res.status(400).json({ success: false, message: e.message }); throw e; }
      await store.save(f.candidate, { ...patch, consentLinkUsedAt: now() });
      res.json({ success: true });
    } catch (e) { console.error('consent form failed:', e.message); res.status(500).json({ success: false, message: 'Server error' }); }
  });
  return router;
}

function makeConsentStore(mongoose) {
  const M = makeModels(mongoose);
  return {
    findByHash: (h) => runUnscoped('public consent link: find the candidate by the hash of its secret token', async () => {
      const c = await M.Candidate.findOne({ consentLinkHash: h }).lean(); if (!c) return null;
      const t = await M.Tenant.findById(c.tenantId).select('agencyName').lean(); return { candidate: c, agencyName: t ? t.agencyName : '' };
    }),
    save: (c, patch) => runWithTenant(String(c.tenantId), () => M.Candidate.updateOne({ _id: c._id, tenantId: c.tenantId }, { $set: { ...patch, lastActivityAt: new Date() } })),
  };
}
module.exports = { createConsentFormRouter, makeConsentStore, linkState, applyAnswer, noticeFor, isDraft, hash, newToken, validToken, LINK_DAYS };
