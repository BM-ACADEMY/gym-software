const DR = require('../src/dataRights'); const { createHireRouter } = require('../src/routes'); const { shapeSummary } = require('../src/internalRoutes');
describe('data rights (pure)', () => {
  const c = { _id: 'c1', tenantId: 'T1', name: 'Ravi', phone: '+919876543210', email: 'r@x.com', location: 'Chennai', skills: ['java'], currentCtc: 500000, consentLinkHash: 'secret', score: 88, consent: { source: 'form', at: 'x', purposeAi: true, withdrawnAt: null } };
  test('export has the person details and consent, never ids, hashes or internal scores', () => {
    const e = DR.candidateExport(c, [{ stage: 'interview', stageAt: 'd', history: [{ stage: 'sourced', at: 'a', evil: 1 }] }]);
    expect(e.candidate.name).toBe('Ravi'); expect(e.candidate.phone).toBe('+919876543210'); expect(e.consent.source).toBe('form');
    const text = JSON.stringify(e); expect(/secret|T1|c1|score|evil/.test(text)).toBe(false);
    expect(e.applications[0].history[0]).toEqual({ stage: 'sourced', at: 'a' });
  });
  test('anonymise wipes personal fields, keeps the row, blocks contact; consent field only when there is consent', () => {
    const u = DR.anonymiseUpdate(new Date('2026-11-12T00:00:00Z'), true);
    expect(u.$set.name).toBe('Removed on request'); expect(u.$set.doNotContact).toBe(true); expect(u.$set['consent.withdrawnAt']).toBeDefined();
    for (const k of ['phone', 'email', 'location', 'currentTitle', 'currentCompany', 'consentLinkHash']) expect(k in u.$unset).toBe(true);
    expect('consent.withdrawnAt' in DR.anonymiseUpdate(new Date(), false).$set).toBe(false);
    expect(DR.isAnonymised({ anonymisedAt: new Date() })).toBe(true); expect(DR.isAnonymised({})).toBe(false);
  });
  test('agency export keeps only agreed fields, says when a list was cut, and has no ids', () => {
    const big = Array.from({ length: DR.CAP + 1 }, () => ({ name: 'x', _id: 'id', tenantId: 'T' }));
    const e = DR.agencyExport({ tenant: { agencyName: 'A', passwordHash: 'p' }, candidates: big, fees: [{ fee: 1000, gst: 180, total: 1180, _id: 'f' }] });
    expect(e.candidates.length).toBe(DR.CAP); expect(e.truncated).toEqual(['candidates']);
    expect(/passwordHash|tenantId|"_id"/.test(JSON.stringify(e))).toBe(false); expect(e.fees[0].total).toBe(1180);
  });
  test('audit line has who and what, never personal details', () => {
    const a = DR.auditEntry({ user: { email: 'o@a.com' } }, 'candidate.exported', 'c1');
    expect(a).toEqual({ who: 'o@a.com', action: 'candidate.exported', ref: 'c1' });
  });
  test('summary counts agencies with a sign-in in 7 days once each; null when not known', () => {
    const billing = { computeStatus: () => ({ status: 'trial', daysLeft: 5 }), mrrOf: () => 0 };
    const t = [{ agencyName: 'A' }, { agencyName: 'B' }];
    expect(shapeSummary({ tenants: t, billing, active7dTenantIds: ['1', '1', '2'], aiCallsToday: 0, aiCostTodayInr: 0, budgetInr: 300 }).businesses.active7d).toBe(2);
    expect(shapeSummary({ tenants: t, billing, aiCallsToday: 0, aiCostTodayInr: 0, budgetInr: 300 }).businesses.active7d).toBe(null);
  });
});
// Routes with spy models: each query must carry the agency id, and non-owners are refused before anything is read.
const spy = () => { const calls = []; const q = (name, result) => ({ find: (f) => (calls.push([name, 'find', f]), chain(result)), findOne: (f) => (calls.push([name, 'findOne', f]), chain(result && result[0] || result)), findById: (f) => (calls.push([name, 'findById', f]), chain({ agencyName: 'A' })), findOneAndUpdate: async (f, u) => (calls.push([name, 'upd', f, u]), result && result[0] || result), create: async (d) => (calls.push([name, 'create', d]), d) }); return { calls, q }; };
const chain = (r) => { const p = Promise.resolve(r); const o = { sort: () => o, limit: () => o, select: () => o, lean: () => p, then: (a, b) => p.then(a, b) }; return o; };
function setup() {
  const s = spy(); const cand = { _id: 'c1', name: 'Ravi', phone: '+91x', consent: { source: 'form' } };
  const models = { HireTenant: s.q('Tenant', []), HireUser: s.q('User', []), HireCandidate: s.q('Candidate', [cand]), HireClient: s.q('Client', []), HireJob: s.q('Job', []), HireEntry: s.q('Entry', []), HireFee: s.q('Fee', []), HireUsage: s.q('Usage', []), HireAutopilot: s.q('Auto', []), HireActivity: s.q('Act', []), HireAudit: s.q('Audit', []) };
  const routes = {}; const router = { use() {}, get: (p, ...h) => (routes['GET ' + p] = h), post: (p, ...h) => (routes['POST ' + p] = h), patch() {}, put() {}, delete() {} };
  createHireRouter({ express: { Router: () => router }, mongoose: { models, Schema: Object.assign(function () {}, { Types: { ObjectId: 'oid', Mixed: 'mixed' } }), Types: { ObjectId: function () {} } }, protect: 1, authorize: () => 1, tenantOf: () => 'T1', planOf: () => ({}), ai: {}, budget: {} });
  return { s, routes };
}
const run = async (hs, role) => { const out = { h: {} }; const req = { params: { id: 'c1' }, query: {}, body: {}, user: { role, email: 'o@a.com' }, get: () => 'h' }; const res = { set() {}, status(c) { out.c = c; return this; }, json(b) { out.b = b; } }; let i = 0; const next = async () => { await hs[++i](req, res, next); }; await hs[0](req, res, next); return out; };
describe('data rights routes', () => {
  test('non-owner is refused on export, anonymise, agency export and audit, and nothing is read', async () => {
    const { s, routes } = setup();
    for (const k of ['GET /candidates/:id/export', 'POST /candidates/:id/anonymise', 'GET /export', 'GET /audit']) { const r = await run(routes[k], 'subadmin'); expect(r.c).toBe(403); }
    expect(s.calls.length).toBe(0);
  });
  test('owner export reads only this agency and writes an audit line; anonymise is audited and scoped', async () => {
    const { s, routes } = setup();
    const e = await run(routes['GET /candidates/:id/export'], 'admin'); expect(e.b.success).toBe(true); expect(e.b.data.candidate.name).toBe('Ravi');
    const a = await run(routes['POST /candidates/:id/anonymise'], 'admin'); expect(a.b.success).toBe(true);
    const x = await run(routes['GET /export'], 'admin'); expect(x.b.data.kind).toBe('agency_data');
    const reads = s.calls.filter((c) => c[1] !== 'create' && c[0] !== 'Tenant'); expect(reads.length > 0).toBe(true);
    for (const c of reads) expect(c[2].tenantId).toBe('T1');
    expect(s.calls.filter((c) => c[0] === 'Audit' && c[1] === 'create').map((c) => c[2].action)).toEqual(['candidate.exported', 'candidate.anonymised', 'agency.exported']);
    expect(s.calls.filter((c) => c[0] === 'Audit').every((c) => c[2].tenantId === 'T1')).toBe(true);
  });
  test('audit list is owner only and scoped', async () => {
    const { s, routes } = setup(); const r = await run(routes['GET /audit'], 'admin'); expect(r.b.success).toBe(true);
    expect(s.calls.filter((c) => c[0] === 'Audit')[0][2]).toEqual({ tenantId: 'T1' });
  });
});
