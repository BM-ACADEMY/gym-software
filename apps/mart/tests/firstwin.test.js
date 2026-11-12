const { call, fakeMongoose, fakeRouter } = require('../../../packages/core-pos/tests/fakeMongoose'); const makeModels = require('../src/models'); const makePos = require('../../../packages/core-pos/src/models');
const { firstWin: FW } = require('../../../packages/core-pos/src'); const { makeConfig } = require('../src/firstWin');
async function setup() {
  const { mongoose } = fakeMongoose(); const M = makeModels(mongoose); const P = makePos(mongoose); const ex = { Router: () => fakeRouter() };
  const router = FW.createFirstWinRouter({ express: ex, mongoose, protect: (q, s, n) => n(), tenantOf: (r) => r.user.tenantId, config: makeConfig(M, P) });
  return { M, P, router, A: 'a'.repeat(24), B: 'b'.repeat(24) };
}
const owner = (t) => ({ user: { tenantId: t, role: 'admin', email: 'o@x.in' } }); const cashier = (t) => ({ user: { tenantId: t, role: 'cashier' } });
describe('Mart first win and set-up checklist', () => {
  test('owner only, sample is labelled when there are no records', async () => {
    const s = await setup(); expect((await call(s.router, 'GET', '/first-win', cashier(s.A))).code).toBe(403); expect((await call(s.router, 'POST', '/setup/sample/remove', cashier(s.A))).code).toBe(403);
    const r = await call(s.router, 'GET', '/first-win', owner(s.A)); expect(r.body.data.mode).toBe('sample'); expect(r.body.data.label).toMatch(/Sample/); expect(r.body.data.headline).toMatch(/Sample/);
  });
  test('sample load and one-tap removal leave nothing behind; other shop untouched', async () => {
    const s = await setup(); await s.P.PosCustomer.create({ tenantId: s.B, name: 'Real', phone: '9840012345', creditDue: 500 });
    expect((await call(s.router, 'POST', '/setup/sample', owner(s.A))).code).toBe(200); expect((await call(s.router, 'POST', '/setup/sample', owner(s.A))).code).toBe(409);
    expect((await s.P.PosBill.find({ tenantId: s.A }).lean()).length).toBe(3); expect((await call(s.router, 'GET', '/setup', owner(s.A))).body.data.steps.find((x) => x.key === 'first_bill').done).toBe(false);
    expect((await call(s.router, 'POST', '/setup/sample/remove', owner(s.A))).code).toBe(200);
    expect((await s.P.PosBill.find({ tenantId: s.A }).lean()).length).toBe(0); expect((await s.P.PosItem.find({ tenantId: s.A }).lean()).length).toBe(0); expect((await s.P.PosCustomer.find({ tenantId: s.B }).lean()).length).toBe(1);
  });
  test('real udhaar is the number, only whole rupees from their own customers; sample refused once real records exist', async () => {
    const s = await setup(); await s.P.PosCustomer.create({ tenantId: s.A, name: 'A', phone: '9840011111', creditDue: 700 }); await s.P.PosCustomer.create({ tenantId: s.A, name: 'B', phone: '9840022222', creditDue: 0 });
    await s.P.PosCustomer.create({ tenantId: s.B, name: 'Other', phone: '9840033333', creditDue: 9999 });
    const r = await call(s.router, 'GET', '/first-win', owner(s.A)); expect(r.body.data.mode).toBe('real'); expect(r.body.data.count).toBe(1); expect(r.body.data.rupees).toBe(700); expect(r.body.data.currency).toBe('INR');
    expect((await call(s.router, 'POST', '/setup/sample', owner(s.A))).code).toBe(400);
    const z = await call(s.router, 'GET', '/first-win', owner(s.B)); expect(z.body.data.rupees).toBe(9999);
  });
  test('checklist: ONE next action, auto steps from records, only manual steps can be ticked, Tamil falls back safely', async () => {
    const s = await setup(); const g = await call(s.router, 'GET', '/setup', owner(s.A)); expect(g.body.data.percent).toBe(0); expect(g.body.data.next.key).toBe('items_added');
    await s.P.PosItem.create({ tenantId: s.A, name: 'Tea', price: 10 }); const h = await call(s.router, 'GET', '/setup', owner(s.A)); expect(h.body.data.percent).toBe(20); expect(h.body.data.next.key).toBe('first_bill');
    expect((await call(s.router, 'POST', '/setup/steps/:key/done', { ...owner(s.A), params: { key: 'items_added' } })).code).toBe(400);
    expect((await call(s.router, 'POST', '/setup/steps/:key/done', { ...owner(s.A), params: { key: 'suggestion_viewed' } })).code).toBe(200);
    const ta = await call(s.router, 'GET', '/setup', { ...owner(s.A), query: { lang: 'ta' } }); expect(ta.code).toBe(200); expect(ta.body.data.steps[0].label.length > 0).toBe(true);
    expect((await call(s.router, 'GET', '/setup', owner(s.B))).body.data.percent).toBe(0);
  });
});
