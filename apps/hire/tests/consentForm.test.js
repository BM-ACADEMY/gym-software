const F = require('../src/consentForm');
const path = require('path'), fs = require('fs'), os = require('os');
const now = new Date('2026-11-10T06:00:00Z');
const approved = path.join(os.tmpdir(), 'approved-notice-' + process.pid + '.txt'); fs.writeFileSync(approved, '{agency} keeps your details to tell you about jobs.\nYou can ask for deletion any time.');
const draft = path.join(__dirname, '..', 'notice', 'consent-notice.txt');
const mkCand = (o = {}) => ({ _id: 'c1', tenantId: 't1', name: 'Asha', phone: '9876543210', consentLinkHash: F.hash('a'.repeat(48)), consentLinkExpires: new Date(now.getTime() + 86400000), ...o });
function setup({ cand = mkCand(), env = { HIRE_CONSENT_NOTICE_VERSION: 'v1' }, noticeFile = approved } = {}) {
  const routes = {}; const router = { get: (p, h) => (routes['GET'] = h), post: (p, h) => (routes['POST'] = h) }; const saved = [];
  F.createConsentFormRouter({ express: { Router: () => router }, store: { findByHash: async (h) => (h === cand.consentLinkHash ? { candidate: cand, agencyName: 'Sri Staffing' } : null), save: async (c, p) => { saved.push(p); } }, env, now: () => now, noticeFile });
  const call = async (m, token, body) => { const out = { c: 200 }; const res = { status(c) { out.c = c; return this; }, json(b) { out.b = b; } }; await routes[m]({ params: { token }, body }, res); return out; };
  return { call, saved };
}
const T = 'a'.repeat(48);
describe('consent form', () => {
  test('closed until a version is set AND the notice file no longer says DRAFT', async () => {
    expect((await setup({ env: {} }).call('GET', T)).c).toBe(503);
    expect((await setup({ noticeFile: draft }).call('GET', T)).c).toBe(503);
    expect(F.isDraft(draft)).toBe(true); expect(F.isDraft(approved)).toBe(false);
  });
  test('shows only the agency name and the notice; no candidate data', async () => {
    const r = await setup().call('GET', T); expect(r.c).toBe(200); expect(r.b.data.agency).toBe('Sri Staffing'); expect(r.b.data.notice).toMatch(/Sri Staffing keeps/);
    expect(JSON.stringify(r.b)).not.toMatch(/Asha|9876543210/);
  });
  test('bad, unknown, used and expired links are refused', async () => {
    expect((await setup().call('GET', 'zz')).c).toBe(404); expect((await setup().call('GET', 'b'.repeat(48))).c).toBe(404);
    expect((await setup({ cand: mkCand({ consentLinkUsedAt: now }) }).call('GET', T)).c).toBe(410);
    expect((await setup({ cand: mkCand({ consentLinkExpires: new Date(now.getTime() - 1) }) }).call('POST', T, { agree: true })).c).toBe(410);
  });
  test('agreeing needs an explicit true; AI consent is separate and also needs an explicit true', async () => {
    const s = setup(); for (const body of [{}, { agree: 'yes' }, { agree: 1 }, null]) expect((await s.call('POST', T, body)).c).toBe(400); expect(s.saved.length).toBe(0);
    const a = setup(); expect((await a.call('POST', T, { agree: true })).c).toBe(200);
    expect(a.saved[0].consent.purposeAi).toBe(false); expect(a.saved[0].consent.source).toBe('candidate_form'); expect(a.saved[0].consent.noticeVersion).toBe('v1'); expect(a.saved[0].consentLinkUsedAt).toEqual(now); expect(a.saved[0].doNotContact).toBe(false);
    const b = setup(); await b.call('POST', T, { agree: true, purposeAi: true }); expect(b.saved[0].consent.purposeAi).toBe(true);
    const c = setup(); await c.call('POST', T, { agree: true, purposeAi: 'true' }); expect(c.saved[0].consent.purposeAi).toBe(false);
  });
  test('tokens are 48 hex characters, random, and stored only as a hash', () => {
    const a = F.newToken(), b = F.newToken(); expect(F.validToken(a)).toBe(true); expect(a === b).toBe(false); expect(F.hash(a)).not.toBe(a); expect(F.hash(a).length).toBe(64);
    expect(F.linkState(null, now)).toBe('none');
  });
});
