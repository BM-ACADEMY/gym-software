const { call, fakeMongoose, fakeRouter } = require('./fake'); const makeModels = require('../src/models');
const { firstWin: FW } = require('../../../packages/core-pos/src'); const { makeConfig } = require('../src/firstWin');
async function setup() {
  const { mongoose } = fakeMongoose(); const M = makeModels(mongoose); const ex = { Router: () => fakeRouter() };
  const router = FW.createFirstWinRouter({ express: ex, mongoose, protect: (q, s, n) => n(), tenantOf: (r) => r.user.tenantId, config: makeConfig(M) });
  const A = await M.Tenant.create({ businessName: 'Alpha' }); const Bt = await M.Tenant.create({ businessName: 'Bravo' });
  return { M, router, A: String(A._id), B: String(Bt._id) };
}
const owner = (t) => ({ user: { tenantId: t, role: 'admin', email: 'o@x.in' } }); const staff = (t) => ({ user: { tenantId: t, role: 'staff' } });
describe('Salon first win and set-up checklist', () => {
  test('pure: percent and ONE next action', () => {
    const s = FW.buildSetup({ steps: [{ key: 'service' }, { key: 'staff' }, { key: 'booking_link', manual: true }], autoDone: { service: true }, marks: {} });
    expect(s.percent).toBe(33); expect(s.next.key).toBe('staff'); expect(s.complete).toBe(false);
  });
  test('owner only', async () => {
    const s = await setup(); expect((await call(s.router, 'GET', '/first-win', staff(s.A))).code).toBe(403); expect((await call(s.router, 'POST', '/setup/sample', staff(s.A))).code).toBe(403);
  });
  test('no records: shows a clearly labelled sample, not theirs', async () => {
    const s = await setup(); const r = await call(s.router, 'GET', '/first-win', owner(s.A));
    expect(r.code).toBe(200); expect(r.body.data.mode).toBe('sample'); expect(r.body.data.label).toMatch(/Sample/); expect(r.body.data.currency).toBe('INR');
  });
  test('load sample, then it is removable in one tap and leaves nothing behind', async () => {
    const s = await setup(); const ld = await call(s.router, 'POST', '/setup/sample', owner(s.A)); expect(ld.code).toBe(200);
    expect((await s.M.Customer.find({ tenantId: s.A }).lean()).length).toBe(3); expect((await s.M.Bill.find({ tenantId: s.A }).lean()).length).toBe(3);
    expect((await call(s.router, 'POST', '/setup/sample', owner(s.A))).code).toBe(409);
    const g = await call(s.router, 'GET', '/first-win', owner(s.A)); expect(g.body.data.mode).toBe('sample'); expect(g.body.data.sampleOn).toBe(true);
    const st = await call(s.router, 'GET', '/setup', owner(s.A)); expect(st.body.data.steps.find((x) => x.key === 'customer').done).toBe(false);
    expect((await call(s.router, 'POST', '/setup/sample/remove', owner(s.A))).code).toBe(200);
    expect((await s.M.Customer.find({ tenantId: s.A }).lean()).length).toBe(0); expect((await s.M.Bill.find({ tenantId: s.A }).lean()).length).toBe(0);
  });
  test('sample never touches another business and is refused when real records exist', async () => {
    const s = await setup(); await s.M.Customer.create({ tenantId: s.B, name: 'Real', phone: '9840012345' });
    await call(s.router, 'POST', '/setup/sample', owner(s.A)); await call(s.router, 'POST', '/setup/sample/remove', owner(s.A));
    expect((await s.M.Customer.find({ tenantId: s.B }).lean()).length).toBe(1);
    await s.M.Customer.create({ tenantId: s.A, name: 'Mine', phone: '9840099999' }); expect((await call(s.router, 'POST', '/setup/sample', owner(s.A))).code).toBe(400);
  });
  test('real bill: the number is theirs; manual step ticks only manual keys; tenants separate', async () => {
    const s = await setup(); const d = FW.istToday();
    await s.M.Bill.create({ tenantId: s.A, number: 'B1', date: d, subtotal: 500, discount: 50, status: 'paid' });
    const r = await call(s.router, 'GET', '/first-win', owner(s.A)); expect(r.body.data.mode).toBe('real'); expect(r.body.data.count).toBe(1); expect(r.body.data.rupees).toBe(450);
    expect((await call(s.router, 'GET', '/first-win', owner(s.B))).body.data.mode).toBe('sample');
    expect((await call(s.router, 'POST', '/setup/steps/:key/done', { ...owner(s.A), params: { key: 'bill' } })).code).toBe(400);
    expect((await call(s.router, 'POST', '/setup/steps/:key/done', { ...owner(s.A), params: { key: 'booking_link' } })).code).toBe(200);
    const st = await call(s.router, 'GET', '/setup', owner(s.A)); expect(st.body.data.steps.find((x) => x.key === 'booking_link').done).toBe(true);
    expect((await call(s.router, 'GET', '/setup', owner(s.B))).body.data.steps.find((x) => x.key === 'booking_link').done).toBe(false);
  });
});
