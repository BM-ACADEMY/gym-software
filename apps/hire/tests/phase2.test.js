const { model, mkRouter, run } = require('./fake');
const HA = require('../src/hireAccounts'); const FC = require('../src/forecast'); const RP = require('../src/rolesPolicy'); const IV = require('../src/interviews'); const MD = require('../src/messageDrafts'); const CR = require('../src/closeRequest');
const { createHireRouter } = require('../src/routes');

describe('Hire accounts (pure)', () => {
  const fees = [{ fee: 100000, gst: 18000, total: 118000, issuedAt: '2026-11-02', paidAt: '2026-11-10' }, { fee: 50000, gst: 9000, total: 59000, issuedAt: '2026-11-03' }];
  const exp = [{ date: '2026-11-05', amount: 20000, category: 'rent', mode: 'bank' }, { date: '2026-10-05', amount: 999, category: 'other', mode: 'cash' }];
  test('expense checks: whole rupees, a real date, unknown category becomes other', () => {
    expect(HA.validateExpense({ date: '2026-11-05', amount: 1.5 }).error).toMatch(/whole/); expect(HA.validateExpense({ date: 'x', amount: 5 }).error).toMatch(/date/);
    const v = HA.validateExpense({ date: '2026-11-05', amount: 500, category: 'weird', mode: 'x' }).value; expect([v.category, v.mode, v.currency]).toEqual(['other', 'bank', 'INR']);
  });
  test('profit and loss counts the fee without GST only when paid, GST on its own line', () => {
    const r = HA.profitAndLoss({ fees, expenses: exp, from: '2026-11-01', to: '2026-11-30' });
    expect(r.income).toBe(100000); expect(r.gstCollected).toBe(18000); expect(r.expenses).toBe(20000); expect(r.netProfit).toBe(80000); expect(r.placementsPaid).toBe(1);
    expect(HA.profitAndLoss({ fees, expenses: exp, from: '2026-11-30', to: '2026-11-01' }).error).toMatch(/from and to/);
  });
  test('cash book runs a balance, money in is fee plus GST', () => {
    const c = HA.cashBook({ fees, expenses: exp, from: '2026-11-01', to: '2026-11-30', opening: 5000 });
    expect(c.rows.map((r) => r.balance)).toEqual([-15000, 103000]); expect(c.closing).toBe(103000);
    expect(HA.cashBook({ fees, expenses: exp, from: '2026-11-01', to: '2026-11-30', opening: 1.5 }).error).toBeTruthy();
  });
  test('CA csv guards spreadsheet formulas', () => {
    expect(HA.cell('=cmd')).toBe("'=cmd"); expect(HA.cell('a,b')).toBe('"a,b"'); expect(HA.cell('+1')).toBe("'+1");
    const r = HA.caCsv({ fees, expenses: [{ date: '2026-11-05', amount: 5, category: '=bad', mode: 'bank' }], from: '2026-11-01', to: '2026-11-30' });
    expect(r.count).toBe(3); expect(r.csv.includes("'=bad")).toBe(true); expect(r.csv.split('\r\n')[0]).toBe('date,type,category,amount,gst,total,status,currency');
  });
});
describe('estimates (pure)', () => {
  test('time to fill needs 3 placements, then gives a median and says estimate', () => {
    const jobs = [{ id: 'j1', createdAt: '2026-10-01' }]; const e = (d) => ({ jobId: 'j1', history: [{ to: 'joined', at: d }] });
    expect(FC.timeToFill({ jobs, entries: [e('2026-10-11')] }).enough).toBe(false);
    const r = FC.timeToFill({ jobs, entries: [e('2026-10-11'), e('2026-10-21'), e('2026-10-31')] }); expect(r.medianDays).toBe(20); expect(r.estimate).toBe(true);
  });
  test('fee forecast weights by stage, skips what it cannot price, and is labelled', () => {
    const r = FC.feeForecast({ jobs: [{ id: 'j1', clientId: 'c1', maxCtc: 1000000 }, { id: 'j2' }], clients: [{ id: 'c1', feeType: 'percent', feeValue: 8 }], entries: [{ jobId: 'j1', stage: 'offer', offeredCtc: 1000000 }, { jobId: 'j1', stage: 'interview' }, { jobId: 'j2', stage: 'offer' }, { jobId: 'j1', stage: 'sourced' }] });
    expect(r.expectedFee).toBe(56000 + 20000); expect(r.counted).toBe(2); expect(r.skipped).toBe(1); expect(r.estimate).toBe(true); expect(r.note).toMatch(/guesses/);
  });
});
describe('recruiter policy, interviews, drafts, close request (pure)', () => {
  test('recruiter blocked from money, exports, team, settings; allowed on candidates and pipeline', () => {
    for (const p of ['/fees', '/fees/1/paid', '/accounts/pnl', '/expenses', '/export', '/export/fees.csv', '/audit', '/team', '/account/close-request', '/autopilot/settings', '/forecast/fees', '/reports/weekly', '/entries/1/fee', '/candidates/1/export', '/candidates/1/anonymise', '/clients/1/share-link']) expect(RP.recruiterBlocked(p)).toBe(true);
    for (const p of ['/candidates', '/candidates/1', '/jobs', '/entries', '/entries/1/move', '/entries/1/interviews', '/interviews', '/autopilot/today', '/clients']) expect(RP.recruiterBlocked(p)).toBe(false);
    expect(RP.validTeamMember({ name: 'Asha', email: 'a@b.co', password: 'longenough1' }).value.role).toBe('recruiter'); expect(RP.validTeamMember({ name: 'A', email: 'x', password: 'p' }).error).toBeTruthy();
  });
  test('interview checks: future time, mode, length, no overlap, stage gate', () => {
    const now = new Date('2026-11-13T00:00:00Z'); const ok = IV.validInterview({ at: '2026-11-14T05:00:00Z', mode: 'video' }, { now });
    expect(ok.value.minutes).toBe(30); expect(IV.validInterview({ at: '2026-11-01T05:00:00Z', mode: 'video' }, { now }).error).toMatch(/passed/);
    expect(IV.validInterview({ at: '2026-11-14T05:00:00Z', mode: 'tv' }, { now }).error).toMatch(/Mode/); expect(IV.validInterview({ at: '2027-11-14T05:00:00Z', mode: 'video' }, { now }).error).toMatch(/6 months/);
    const ex = [{ at: '2026-11-14T05:00:00Z', minutes: 30, status: 'scheduled' }];
    expect(IV.clash(ex, new Date('2026-11-14T05:20:00Z'), 30)).toBe(true); expect(IV.clash(ex, new Date('2026-11-14T05:30:00Z'), 30)).toBe(false); expect(IV.clash([{ ...ex[0], status: 'cancelled' }], new Date('2026-11-14T05:10:00Z'), 30)).toBe(false);
    expect(IV.stageOk('interview')).toBe(true); expect(IV.stageOk('sourced')).toBe(false);
  });
  test('drafts are never sendable, and nothing is drafted for a person who withdrew, was removed or has no consent', () => {
    const cand = { name: 'Ravi Kumar', consent: { source: 'form' } }; const iv = { at: '2026-11-14T05:00:00Z', mode: 'phone' };
    const d = MD.interviewReminder({ candidate: cand, job: { title: 'Accountant' }, interview: iv, agency: 'Acme' }); expect(d.sendable).toBe(false); expect(d.text).toMatch(/Ravi/); expect(d.text).toMatch(/Accountant/); expect(d.note).toMatch(/Draft only/);
    for (const c of [{ ...cand, doNotContact: true }, { ...cand, anonymisedAt: new Date() }, { name: 'x', consent: { source: 'form', withdrawnAt: new Date() } }, { name: 'x' }]) { const r = MD.interviewReminder({ candidate: c, interview: iv }); expect(!!r.blocked).toBe(true); expect(r.text).toBe(undefined); }
    expect(MD.feeReminder({ client: { name: 'C' }, fee: { total: 118000, paidAt: new Date() } }).blocked).toMatch(/paid/); expect(MD.feeReminder({ client: { name: 'C' }, fee: { total: 118000, dueDate: '2026-12-01' } }).text).toMatch(/118000/);
  });
  test('close request waits, can be cancelled only before the date', () => {
    const p = CR.plan({ now: new Date('2026-11-13T00:00:00Z') }); expect(p.deleteAfter.toISOString().slice(0, 10)).toBe('2026-12-13'); expect(CR.canCancel(p, new Date('2026-12-01T00:00:00Z'))).toBe(true); expect(CR.canCancel(p, new Date('2026-12-14T00:00:00Z'))).toBe(false);
  });
});

const NAMES = ['Tenant', 'User', 'Candidate', 'Client', 'Job', 'Entry', 'Fee', 'UsageLog', 'AutopilotSettings', 'ActivityLog', 'Audit', 'Expense', 'Interview', 'CloseRequest'];
const DB = { UsageLog: 'HireUsage', AutopilotSettings: 'HireAutopilot', ActivityLog: 'HireActivity' };
const mk = () => {
  const { r, router, mw } = mkRouter(); const models = Object.fromEntries(NAMES.map((n) => [DB[n] || 'Hire' + n, model()]));
  createHireRouter({ express: { Router: () => router }, mongoose: { models, Schema: Object.assign(function () {}, { Types: { ObjectId: 'oid', Mixed: 'mixed' } }), Types: { ObjectId: function () {} } }, protect: (q, s, n) => n(), authorize: () => (q, s, n) => n(), tenantOf: (req) => req.user.tenantId, planOf: () => ({}), ai: {}, budget: {} });
  const M = Object.fromEntries(NAMES.map((n) => [n, models[DB[n] || 'Hire' + n]]));
  const go = (key, user, extra = {}) => run(mw, r[key], { user, method: key.split(' ')[0], path: key.split(' ')[1].replace(/:\w+/g, 'x'), ...extra });
  return { M, go };
};
const A = { id: 'u1', tenantId: 'a', role: 'admin', email: 'o@a.com' }; const B = { id: 'u2', tenantId: 'b', role: 'admin' }; const S = { id: 'u3', tenantId: 'a', role: 'subadmin' }; const R = { id: 'u4', tenantId: 'a', role: 'recruiter' };
describe('Hire phase 2 routes: owner only, this agency only', () => {
  test('recruiter and subadmin are refused on money and team routes; recruiter on every delete', async () => {
    const { M, go } = mk();
    for (const k of ['GET /expenses', 'GET /accounts/pnl', 'GET /accounts/ca.csv', 'GET /export/:file', 'GET /team', 'POST /team', 'POST /account/close-request']) { expect((await go(k, S)).c).toBe(403); expect((await go(k, R)).c).toBe(403); }
    for (const k of ['GET /fees', 'GET /forecast/fees', 'POST /fees/:id/paid', 'GET /fees/:id/draft']) expect((await go(k, R)).c).toBe(403);
    expect((await go('DELETE /candidates/:id', R, { params: { id: 'x' } })).c).toBe(403);
    expect(M.Audit.rows.length).toBe(0); expect(M.Expense.rows.length).toBe(0);
  });
  test('expenses, profit and loss and downloads see only this agency, and downloads are audited and safe', async () => {
    const { M, go } = mk();
    await M.Fee.create({ tenantId: 'a', fee: 1000, gst: 180, total: 1180, issuedAt: new Date('2026-11-02'), dueDate: new Date('2026-12-01'), paidAt: new Date('2026-11-10') }); await M.Fee.create({ tenantId: 'b', fee: 9999, gst: 1, total: 10000, issuedAt: new Date('2026-11-02'), paidAt: new Date('2026-11-10') });
    expect((await go('POST /expenses', A, { body: { date: '2026-11-05', amount: 1.5 } })).c).toBe(400);
    expect((await go('POST /expenses', A, { body: { date: '2026-11-05', amount: 300, category: 'rent', note: '=HYPERLINK("x")' } })).c).toBe(201);
    await go('POST /expenses', B, { body: { date: '2026-11-05', amount: 77777, category: 'rent' } });
    expect((await go('GET /expenses', A)).b.data.map((x) => x.amount)).toEqual([300]);
    const p = await go('GET /accounts/pnl', A, { query: { from: '2026-11-01', to: '2026-11-30' } }); expect(p.b.data.income).toBe(1000); expect(p.b.data.expenses).toBe(300); expect(p.b.data.netProfit).toBe(700);
    expect((await go('GET /accounts/pnl', A, { query: { from: 'bad', to: '2026-11-30' } })).c).toBe(400);
    const d = await go('GET /export/:file', A, { params: { file: 'expenses.csv' } }); expect(d.text.includes("'=HYPERLINK")).toBe(true); expect(d.text.includes('77777')).toBe(false); expect(d.h['Content-Disposition']).toMatch(/hire-expenses.csv/);
    expect((await go('GET /export/:file', A, { params: { file: '..passwd.csv' } })).c).toBe(404); expect((await go('GET /export/:file', A, { params: { file: 'constructor.csv' } })).c).toBe(404); expect((await go('GET /export/:file', A, { params: { file: 'users.csv' } })).c).toBe(404);
    expect(M.Audit.rows.filter((x) => x.action === 'export.expenses' && x.tenantId === 'a').length).toBe(1);
    const ca = await go('GET /accounts/ca.csv', A, { query: { from: '2026-11-01', to: '2026-11-30' } }); expect(ca.text.includes('placement_fee')).toBe(true); expect(ca.text.includes('9999')).toBe(false);
  });
  test('recruiter login: owner creates, password never stored plain or returned, duplicate email refused, switch off is scoped', async () => {
    const { M, go } = mk();
    expect((await go('POST /team', A, { body: { name: 'Asha', email: 'bad', password: 'longenough1' } })).c).toBe(400);
    const c = await go('POST /team', A, { body: { name: 'Asha', email: 'Asha@Acme.com', password: 'longenough1' } }); expect(c.c).toBe(201); expect(JSON.stringify(c.b).includes('longenough1')).toBe(false);
    expect(M.User.rows[0].role).toBe('recruiter'); expect(M.User.rows[0].passwordHash.startsWith('scrypt$')).toBe(true); expect(M.User.rows[0].passwordHash.includes('longenough1')).toBe(false);
    const l = await go('GET /team', A); expect(l.b.data.length).toBe(1); expect(JSON.stringify(l.b).includes('scrypt')).toBe(false); expect((await go('GET /team', B)).b.data.length).toBe(0);
    expect((await go('POST /team/:id/off', B, { params: { id: String(M.User.rows[0]._id) } })).c).toBe(404);
    expect((await go('POST /team/:id/off', A, { params: { id: String(M.User.rows[0]._id) } })).c).toBe(200); expect(M.User.rows[0].isActive).toBe(false);
    await M.User.create({ tenantId: 'a', name: 'Owner', email: 'o@a.com', role: 'admin' }); expect((await go('POST /team/:id/off', A, { params: { id: String(M.User.rows[1]._id) } })).c).toBe(404);
  });
  test('close request: needs confirm, one at a time, waits, cancels only for this agency', async () => {
    const { M, go } = mk();
    expect((await go('POST /account/close-request', A, { body: {} })).c).toBe(400);
    const c = await go('POST /account/close-request', A, { body: { confirm: true, reason: 'closing shop' } }); expect(c.c).toBe(201); expect(c.b.message).toMatch(/cancel/);
    expect((await go('POST /account/close-request', A, { body: { confirm: true } })).c).toBe(409);
    expect((await go('GET /account/close-request', A)).b.data.status).toBe('requested'); expect((await go('GET /account/close-request', B)).b.data).toBe(null);
    expect((await go('POST /account/close-request/cancel', B)).c).toBe(404); expect((await go('POST /account/close-request/cancel', A)).c).toBe(200);
    expect((await go('POST /account/close-request', A, { body: { confirm: true } })).c).toBe(201); expect(M.Audit.rows.map((x) => x.action)).toEqual(['account.close_requested', 'account.close_cancelled', 'account.close_requested']);
  });
  test('interviews: stage gate, no overlap, scoped; drafts suggest only and respect consent', async () => {
    const { M, go } = mk(); const soon = new Date(Date.now() + 2 * 864e5).toISOString();
    const cand = await M.Candidate.create({ tenantId: 'a', name: 'Ravi Kumar', consent: { source: 'form' } }); const noC = await M.Candidate.create({ tenantId: 'a', name: 'No Consent' });
    const job = await M.Job.create({ tenantId: 'a', title: 'Accountant' }); const e1 = await M.Entry.create({ tenantId: 'a', jobId: job._id, candidateId: cand._id, stage: 'submitted' }); const e2 = await M.Entry.create({ tenantId: 'a', jobId: job._id, candidateId: noC._id, stage: 'sourced' });
    const body = { at: soon, mode: 'video' };
    expect((await go('POST /entries/:id/interviews', A, { params: { id: String(e2._id) }, body })).c).toBe(400);
    expect((await go('POST /entries/:id/interviews', B, { params: { id: String(e1._id) }, body })).c).toBe(404);
    const ok = await go('POST /entries/:id/interviews', R, { params: { id: String(e1._id) }, body }); expect(ok.c).toBe(201);
    expect((await go('POST /entries/:id/interviews', A, { params: { id: String(e1._id) }, body })).c).toBe(409);
    expect((await go('GET /interviews', A)).b.data[0].candidate).toBe('Ravi Kumar'); expect((await go('GET /interviews', B)).b.data.length).toBe(0);
    // from the panel form, by name
    const pf = (b, u = A) => go('POST /interviews', u, { body: { at: new Date(Date.now() + 3 * 864e5).toISOString(), mode: 'phone', ...b } });
    expect((await pf({})).c).toBe(400); expect((await pf({ candidate: 'Nobody' })).c).toBe(404); expect((await pf({ candidate: 'No Consent' })).c).toBe(400); expect((await pf({ candidate: 'Ravi Kumar' }, B)).c).toBe(404);
    expect((await pf({ candidate: 'Ravi Kumar', job: 'Other job' })).c).toBe(400); expect((await pf({ candidate: 'Ravi Kumar', job: 'Accountant' })).c).toBe(201); expect((await go('GET /interviews', A)).b.data.length).toBe(2);
    const d = await go('GET /interviews/:id/draft', R, { params: { id: ok.b.data.id } }); expect(d.b.data.sendable).toBe(false); expect(d.b.data.text).toMatch(/Ravi/);
    expect((await go('GET /interviews/:id/draft', B, { params: { id: ok.b.data.id } })).c).toBe(404);
    await M.Candidate.findOneAndUpdate({ _id: cand._id }, { $set: { doNotContact: true } }); expect(!!(await go('GET /interviews/:id/draft', A, { params: { id: ok.b.data.id } })).b.data.blocked).toBe(true);
    expect((await go('POST /interviews/:id/cancel', B, { params: { id: ok.b.data.id } })).c).toBe(404); expect((await go('POST /interviews/:id/cancel', A, { params: { id: ok.b.data.id } })).c).toBe(200); expect((await go('GET /interviews', A)).b.data.length).toBe(1);
  });
  test('forecasts read this agency only', async () => {
    const { M, go } = mk(); const c = await M.Client.create({ tenantId: 'a', name: 'C', feeType: 'percent', feeValue: 10 }); const j = await M.Job.create({ tenantId: 'a', title: 'T', clientId: c._id, maxCtc: 500000 });
    await M.Entry.create({ tenantId: 'a', jobId: j._id, candidateId: 'x1', stage: 'offer' }); await M.Entry.create({ tenantId: 'b', jobId: j._id, candidateId: 'x2', stage: 'offer' });
    expect((await go('GET /forecast/fees', A)).b.data.expectedFee).toBe(35000); expect((await go('GET /forecast/fees', B)).b.data.expectedFee).toBe(0); expect((await go('GET /forecast/time-to-fill', S)).b.data.enough).toBe(false);
  });
});
