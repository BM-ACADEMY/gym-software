const { call, fakeMongoose, fakeRouter } = require('../../../packages/core-pos/tests/fakeMongoose'); const makeModels = require('../src/models');
const { firstWin: FW } = require('../../../packages/core-pos/src'); const { makeConfig } = require('../src/firstWin');
async function setup() {
  const { mongoose } = fakeMongoose(); const M = makeModels(mongoose); const ex = { Router: () => fakeRouter() };
  const router = FW.createFirstWinRouter({ express: ex, mongoose, protect: (q, s, n) => n(), tenantOf: (r) => r.user.tenantId, config: makeConfig(M) });
  return { M, router, A: 'a'.repeat(24), B: 'b'.repeat(24) };
}
const owner = (t) => ({ user: { tenantId: t, role: 'admin', email: 'o@x.in' } }); const sub = (t) => ({ user: { tenantId: t, role: 'subadmin' } });
describe('Dine first win and set-up checklist', () => {
  test('owner only; sample label when no records', async () => {
    const s = await setup(); expect((await call(s.router, 'GET', '/first-win', sub(s.A))).code).toBe(403); expect((await call(s.router, 'POST', '/setup/sample', sub(s.A))).code).toBe(403);
    const r = await call(s.router, 'GET', '/first-win', owner(s.A)); expect(r.body.data.mode).toBe('sample'); expect(r.body.data.label).toMatch(/Sample/);
  });
  test('sample on and off in one tap, nothing left, other venue untouched', async () => {
    const s = await setup(); await s.M.Customer.create({ tenantId: s.B, name: 'Real', phone: '9840012345', visits: ['2026-01-01'] });
    expect((await call(s.router, 'POST', '/setup/sample', owner(s.A))).code).toBe(200); expect((await s.M.Order.find({ tenantId: s.A }).lean()).length).toBe(3);
    expect((await call(s.router, 'GET', '/setup', owner(s.A))).body.data.steps.find((x) => x.key === 'first_order_paid').done).toBe(false);
    expect((await call(s.router, 'POST', '/setup/sample/remove', owner(s.A))).code).toBe(200);
    expect((await s.M.Order.find({ tenantId: s.A }).lean()).length).toBe(0); expect((await s.M.MenuItem.find({ tenantId: s.A }).lean()).length).toBe(0); expect((await s.M.Customer.find({ tenantId: s.B }).lean()).length).toBe(1);
  });
  test('real: quiet guests counted from their own visits, rupees = their own average paid bill, opted-out guests left out', async () => {
    const s = await setup(); const d = FW.istToday();
    await s.M.Customer.create({ tenantId: s.A, name: 'G1', phone: '9840011111', visits: [FW.addDays(d, -100), FW.addDays(d, -90)] });
    await s.M.Customer.create({ tenantId: s.A, name: 'G2', phone: '9840022222', visits: [FW.addDays(d, -90)], doNotContact: true });
    await s.M.Customer.create({ tenantId: s.A, name: 'G3', phone: '9840033333', visits: [FW.addDays(d, -2)] });
    await s.M.Order.create({ tenantId: s.A, number: 'D1', status: 'paid', grandTotal: 400, currency: 'INR' }); await s.M.Order.create({ tenantId: s.A, number: 'D2', status: 'paid', grandTotal: 200, currency: 'INR' });
    const r = await call(s.router, 'GET', '/first-win', owner(s.A)); expect(r.body.data.mode).toBe('real'); expect(r.body.data.count).toBe(1); expect(r.body.data.rupees).toBe(300);
    expect((await call(s.router, 'POST', '/setup/sample', owner(s.A))).code).toBe(400);
    expect((await call(s.router, 'GET', '/first-win', owner(s.B))).body.data.mode).toBe('sample');
  });
  test('checklist: ONE next action, manual steps only tickable by key', async () => {
    const s = await setup(); const g = await call(s.router, 'GET', '/setup', owner(s.A)); expect(g.body.data.next.key).toBe('menu_added');
    await s.M.MenuItem.create({ tenantId: s.A, key: 'tea', name: 'Tea', price: 20 }); expect((await call(s.router, 'GET', '/setup', owner(s.A))).body.data.next.key).toBe('first_order_paid');
    expect((await call(s.router, 'POST', '/setup/steps/:key/done', { ...owner(s.A), params: { key: 'menu_added' } })).code).toBe(400);
    expect((await call(s.router, 'POST', '/setup/steps/:key/done', { ...owner(s.A), params: { key: 'qr_menu_shared' } })).code).toBe(200);
    expect((await call(s.router, 'GET', '/setup', owner(s.B))).body.data.percent).toBe(0);
  });
});
