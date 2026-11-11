const { createWashRouter } = require('../src/routes');
const { makeFakeModels } = require('./fakeModels');
const fs = require('fs');
function harness() {
  const h = {}; const router = { use: () => {}, get: (p, ...f) => (h['GET ' + p] = f), post: (p, ...f) => (h['POST ' + p] = f), put: (p, ...f) => (h['PUT ' + p] = f) };
  const M = makeFakeModels(); let clock = new Date('2026-11-12T08:00:00Z');
  createWashRouter({ express: { Router: () => router }, models: M, protect: 'P', authorize: () => 'A', tenantOf: (req) => req.user.tenantId, planOf: () => 'growth', now: () => clock });
  const call = async (key, tenant, { body = {}, query = {}, params = {}, role = 'admin' } = {}) => {
    const o = { headers: {} }; const req = { user: { id: 'u', tenantId: tenant, role }, body, query, params };
    const res = { set: (k, v) => { o.headers[k] = v; }, send: (b) => { o.text = b; }, status(c) { o.c = c; return this; }, json(b) { o.b = b; if (!o.c) o.c = 200; } };
    const chain = h[key]; for (let i = 0; i < chain.length; i++) { let went = false; await chain[i](req, res, () => { went = true; }); if (!went) break; }
    return o;
  };
  return { call, M, h };
}
const T1 = 'aaaaaaaaaaaaaaaaaaaaaaa1', T2 = 'aaaaaaaaaaaaaaaaaaaaaaa2';
describe('panel screens (Phase 2 step 1)', () => {
  test('manifest: cancelling a started job offers fixed reasons, and the screens for accounts, discounts and audit exist for the owner', () => {
    const m = JSON.parse(fs.readFileSync(__dirname + '/../admin/manifest.json', 'utf8'));
    const cancels = m.resources.jobs.actions.filter((a) => a.body && a.body.to === 'cancelled' && a.when.equals === 'washing');
    expect(cancels.length).toBe(3); expect(cancels.every((a) => a.body.reason.length >= 3)).toBe(true);
    for (const k of ['accounts', 'leaks', 'audit']) { const n = m.nav.find((x) => x.key === k); expect(!!n).toBe(true); expect(n.roles).toEqual(['admin']); }
  });
  test('accounts overview: P&L, customer dues and supplier dues; another business sees none of it', async () => {
    const H = harness();
    await H.M.Job.create({ tenantId: T1, number: 1, plate: 'TN09AB1234', day: '2026-11-12', state: 'delivered', total: 500, due: 200, payments: [{ method: 'cash', amount: 300 }] });
    await H.M.Expense.create({ tenantId: T1, day: '2026-11-12', category: 'water', amount: 100, paid: false, supplier: 'Tanker Raj' });
    const r = await H.call('GET /accounts/overview', T1, { query: { from: '2026-11-01', to: '2026-11-30' } });
    expect(r.c).toBe(200); expect(r.b.data.pnl.revenue).toBe(500); expect(r.b.data.customerDueTotal).toBe(200); expect(r.b.data.customerDues[0].plate).toBe('TN09AB1234'); expect(r.b.data.supplierDues[0].due).toBe(100);
    const o = await H.call('GET /accounts/overview', T2, { query: { from: '2026-11-01', to: '2026-11-30' } });
    expect(o.b.data.pnl.revenue).toBe(0); expect(o.b.data.customerDues.length).toBe(0); expect(o.b.data.supplierDues.length).toBe(0);
    expect((await H.call('GET /accounts/overview', T1, { query: { from: '2026-01-01', to: '2027-12-31' } })).c).toBe(400);
  });
  test('P&L takes refunds off revenue', async () => {
    const H = harness();
    await H.M.Job.create({ tenantId: T1, number: 1, plate: 'TN09AB1234', day: '2026-11-12', state: 'delivered', total: 500, payments: [] });
    await H.M.Refund.create({ tenantId: T1, jobId: 'x', day: '2026-11-12', amount: 150, method: 'cash', reason: 'redo' });
    const r = await H.call('GET /accounts/pnl', T1, { query: { from: '2026-11-01', to: '2026-11-30' } });
    expect(r.b.data.revenue).toBe(350); expect(r.b.data.refunded).toBe(150);
  });
});
