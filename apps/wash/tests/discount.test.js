const DP = require('../src/discountPolicy'); const L = require('../src/leaks'); const { summarize } = require('../src/summary');
const { createWashRouter } = require('../src/routes'); const { makeFakeModels } = require('./fakeModels');
function harness() {
  const h = {}; const router = { use() {}, get: (p, ...f) => (h['GET ' + p] = f), post: (p, ...f) => (h['POST ' + p] = f), put: (p, ...f) => (h['PUT ' + p] = f) };
  const M = makeFakeModels();
  createWashRouter({ express: { Router: () => router }, models: M, protect: 'P', authorize: () => 'A', tenantOf: (r) => r.user.tenantId, planOf: () => 'growth', now: () => new Date('2026-11-12T08:00:00Z') });
  const call = async (key, tenant, role, { body = {}, query = {} } = {}) => {
    const o = {}; const req = { user: { id: 'u', tenantId: tenant, role }, body, query, params: {} };
    const res = { set() {}, status(c) { o.c = c; return this; }, json(b) { o.b = b; if (!o.c) o.c = 200; } };
    const fns = h[key]; let i = 0; const next = async () => { const f = fns[i++]; if (f) await f(req, res, next); }; await next(); return o;
  };
  return { call, M };
}
const T1 = 'aaaaaaaaaaaaaaaaaaaaaaa1', T2 = 'aaaaaaaaaaaaaaaaaaaaaaa2';
const prices = { prices: { sedan: 400 }, addons: {} };
describe('staff discount rule (D-30)', () => {
  test('policy: default 10 percent for staff, owner never limited, bad rule falls back', () => {
    expect(DP.normalize(undefined)).toEqual({ staff: 'limit', maxPercent: 10 });
    expect(DP.check({ role: 'staff', discount: 40, subtotal: 400 }).ok).toBe(true);
    expect(DP.check({ role: 'staff', discount: 41, subtotal: 400 }).ok).toBe(false);
    expect(DP.check({ role: 'admin', discount: 399, subtotal: 400, rule: { staff: 'owner_only' } }).ok).toBe(true);
    expect(DP.check({ role: 'staff', discount: 1, subtotal: 400, rule: { staff: 'owner_only' } }).ok).toBe(false);
  });
  test('job: reason required; staff over the limit refused (403); within it saved with who, percent and an audit line', async () => {
    const H = harness(); await H.call('PUT /price-list', T1, 'admin', { body: prices });
    const mk = (role, discount, reason) => H.call('POST /jobs', T1, role, { body: { plate: 'TN09AB1234', klass: 'sedan', discount, discountReason: reason } });
    expect((await mk('staff', { type: 'amount', value: 20 }, '')).c).toBe(400);
    expect((await mk('staff', { type: 'amount', value: 100 }, 'regular')).c).toBe(403);
    expect((await mk('staff', { type: 'weird', value: 1 }, 'regular')).c).toBe(400);
    expect((await mk('admin', { type: 'amount', value: 500 }, 'regular')).c).toBe(400);
    const s = await mk('staff', { type: 'percent', value: 10 }, 'regular customer');
    expect(s.c).toBe(201); expect(s.b.data.total).toBe(360); expect(s.b.data.discountBy).toBe('staff'); expect(s.b.data.discountPercent).toBe(10); expect(s.b.data.subtotal).toBe(400);
    const o = await mk('admin', { type: 'amount', value: 200 }, 'friend'); expect(o.b.data.discountBy).toBe('owner'); expect(o.b.data.total).toBe(200);
    const a = (await H.call('GET /audit', T1, 'admin')).b.data; expect(a.length).toBe(2); expect(a.some((x) => /10% by staff: regular customer/.test(x.text))).toBe(true);
    expect((await H.call('GET /audit', T2, 'admin')).b.data.length).toBe(0);
  });
  test('owner settings: only the owner reads or changes; rule changes what staff may do; per business', async () => {
    const H = harness(); await H.call('PUT /price-list', T1, 'admin', { body: prices });
    expect((await H.call('PUT /settings', T1, 'subadmin', { body: { discountRule: { staff: 'any' } } })).c).toBe(403);
    expect((await H.call('GET /settings', T1, 'subadmin')).c).toBe(403);
    expect((await H.call('PUT /settings', T1, 'admin', { body: {} })).c).toBe(400);
    expect((await H.call('PUT /settings', T1, 'admin', { body: { discountRule: { staff: 'owner_only' } } })).c).toBe(200);
    expect((await H.call('POST /jobs', T1, 'subadmin', { body: { plate: 'TN09AB1234', klass: 'sedan', discount: { type: 'amount', value: 5 }, discountReason: 'regular' } })).c).toBe(403);
    expect((await H.call('GET /settings', T2, 'admin')).b.data.discountRule).toEqual({ staff: 'limit', maxPercent: 10 });
    expect((await H.call('PUT /settings', T1, 'admin', { body: { discountRule: { staff: 'limit', maxPercent: 25 } } })).c).toBe(200);
    expect((await H.call('POST /jobs', T1, 'subadmin', { body: { plate: 'TN09AB1234', klass: 'sedan', discount: { type: 'amount', value: 100 }, discountReason: 'regular' } })).c).toBe(201);
  });
  test('a discount cannot eat into the part a monthly pass already covers', async () => {
    const H = harness(); await H.call('PUT /price-list', T1, 'admin', { body: { prices: { sedan: 400 }, addons: { wax: 150 } } });
    await H.call('POST /passes', T1, 'admin', { body: { plate: 'TN09AB1234', washes: 4, price: 999 } });
    const base = { plate: 'TN09AB1234', klass: 'sedan', addons: ['wax'], discountReason: 'regular' };
    expect((await H.call('POST /jobs', T1, 'admin', { body: { ...base, discount: { type: 'amount', value: 200 } } })).c).toBe(400);
    expect((await H.call('POST /jobs', T1, 'admin', { body: { ...base, discount: { type: 'amount', value: 100 } } })).c).toBe(201);
  });
  test('leaks: staff discounts and started-then-cancelled jobs per day; shown to owner only, in the summary and /leaks', async () => {
    const jobs = [{ day: '2026-11-12', discount: 40, discountBy: 'staff', state: 'delivered' }, { day: '2026-11-12', discount: 30, discountBy: 'staff', state: 'waiting' }, { day: '2026-11-12', discount: 90, discountBy: 'owner', state: 'delivered' }, { day: '2026-11-12', state: 'cancelled', startedAt: 'x', total: 400 }, { day: '2026-11-12', state: 'cancelled', total: 300 }];
    expect(L.staffDiscounts(jobs)).toEqual([{ date: '2026-11-12', count: 2, total: 70, currency: 'INR' }]);
    expect(L.voids(jobs)[0].count).toBe(1); expect(L.voids(jobs)[0].total).toBe(400);
    expect(L.leakList({ jobs }).length).toBe(2);
    const s = summarize({ today: '2026-11-12', nowIso: '2026-11-12T16:00:00Z', jobs });
    expect(s.facts.leaks.staffDiscounts[0].total).toBe(70); expect(s.actions.map((a) => a.key).includes('staffDiscounts')).toBe(true);
    const H = harness(); H.M.Job.rows.push({ _id: 'j1', tenantId: T1, day: '2026-11-12', discount: 40, discountBy: 'staff', state: 'delivered' }, { _id: 'j2', tenantId: T2, day: '2026-11-12', discount: 99, discountBy: 'staff', state: 'delivered' });
    expect((await H.call('GET /leaks', T1, 'subadmin')).c).toBe(403);
    expect((await H.call('GET /leaks', T1, 'admin')).b.data.staffDiscounts[0].total).toBe(40);
  });
});

// SET-03: cancelling after washing began needs a reason; before washing it does not.
describe('cancel after washing began needs a reason (SET-03)', () => {
  const { createWashRouter } = require('../src/routes'); const { makeFakeModels } = require('./fakeModels');
  const mkH = () => {
    const h = {}; const router = { use() {}, get: (p, f) => (h['GET ' + p] = f), post: (p, f) => (h['POST ' + p] = f), put: (p, f) => (h['PUT ' + p] = f) };
    const M = makeFakeModels(); createWashRouter({ express: { Router: () => router }, models: M, protect: 'P', authorize: () => 'A', tenantOf: (r) => r.user.tenantId, planOf: () => 'growth', now: () => new Date('2026-11-12T08:00:00Z') });
    const call = async (key, { body = {}, params = {} } = {}) => { const o = {}; await h[key]({ user: { id: 'u', role: 'admin', tenantId: 'aaaaaaaaaaaaaaaaaaaaaaa1' }, body, query: {}, params }, { set() {}, status(c) { o.c = c; return this; }, json(b) { o.b = b; if (!o.c) o.c = 200; } }); return o; };
    return { call, M };
  };
  test('waiting job cancels without a reason; a washing job needs 3 letters and the reason is saved and audited', async () => {
    const H = mkH(); await H.call('PUT /price-list', { body: { prices: { sedan: 400 }, addons: {}, incentive: {} } });
    await H.call('POST /attendants', { body: { name: 'Murugan' } });
    const a = (await H.call('POST /jobs', { body: { plate: 'TN09AB1234', klass: 'sedan' } })).b.data.id;
    expect((await H.call('POST /jobs/:id/move', { params: { id: a }, body: { to: 'cancelled' } })).c).toBe(200);
    const b = (await H.call('POST /jobs', { body: { plate: 'TN09AB5678', klass: 'sedan' } })).b.data.id;
    expect((await H.call('POST /jobs/:id/move', { params: { id: b }, body: { to: 'washing' } })).c).toBe(200);
    expect((await H.call('POST /jobs/:id/move', { params: { id: b }, body: { to: 'cancelled' } })).c).toBe(400);
    expect((await H.call('POST /jobs/:id/move', { params: { id: b }, body: { to: 'cancelled', reason: 'ab' } })).c).toBe(400);
    const ok = await H.call('POST /jobs/:id/move', { params: { id: b }, body: { to: 'cancelled', reason: 'Customer left' } });
    expect(ok.c).toBe(200); expect(ok.b.data.cancelReason).toBe('Customer left');
    expect(H.M.Audit.rows.some((x) => x.action === 'job.cancel' && /Customer left/.test(x.text))).toBe(true);
  });
});
