const { call, fakeMongoose, fakeRouter } = require('../../../packages/core-pos/tests/fakeMongoose'); const makeModels = require('../src/models'); const makePos = require('../../../packages/core-pos/src/models');
const { firstWin: FW } = require('../../../packages/core-pos/src'); const { makeConfig } = require('../src/firstWin');
async function setup() {
  const { mongoose } = fakeMongoose(); const M = makeModels(mongoose); const pos = makePos(mongoose); const ex = { Router: () => fakeRouter() };
  const router = FW.createFirstWinRouter({ express: ex, mongoose, protect: (q, s, n) => n(), tenantOf: (r) => r.user.tenantId, config: makeConfig(M, pos) });
  return { M, pos, router, A: 'a'.repeat(24), B: 'b'.repeat(24) };
}
const owner = (t) => ({ user: { tenantId: t, role: 'admin', email: 'o@x.in' } }); const sub = (t) => ({ user: { tenantId: t, role: 'subadmin' } });
const V = (t, o) => ({ tenantId: t, style: 'Kurta', size: 'M', colour: 'Blue', mrp: 800, currency: 'INR', ...o });
describe('Cloth first win and set-up checklist', () => {
  test('owner only; sample label when no stock yet', async () => {
    const s = await setup(); expect((await call(s.router, 'GET', '/first-win', sub(s.A))).code).toBe(403); expect((await call(s.router, 'POST', '/setup/sample', sub(s.A))).code).toBe(403);
    const r = await call(s.router, 'GET', '/first-win', owner(s.A)); expect(r.body.data.mode).toBe('sample'); expect(r.body.data.label).toMatch(/Sample/);
  });
  test('sample on and off in one tap; nothing left; other shop untouched', async () => {
    const s = await setup(); await s.M.Variant.create(V(s.B, { key: 'K1', qty: 2 }));
    expect((await call(s.router, 'POST', '/setup/sample', owner(s.A))).code).toBe(200); expect((await s.M.Variant.find({ tenantId: s.A }).lean()).length).toBe(3);
    expect((await call(s.router, 'GET', '/setup', owner(s.A))).body.data.steps.find((x) => x.key === 'variants_added').done).toBe(false);
    expect((await call(s.router, 'POST', '/setup/sample/remove', owner(s.A))).code).toBe(200);
    expect((await s.M.Variant.find({ tenantId: s.A }).lean()).length).toBe(0); expect((await s.pos.PosBill.find({ tenantId: s.A }).lean()).length).toBe(0); expect((await s.M.Variant.find({ tenantId: s.B }).lean()).length).toBe(1);
  });
  test('real: slow items = in stock with no sale for 90 days; value uses cost when known else MRP', async () => {
    const s = await setup(); const d = FW.istToday();
    await s.M.Variant.create(V(s.A, { key: 'K1', qty: 3, cost: 300, lastSoldOn: FW.addDays(d, -120) })); await s.M.Variant.create(V(s.A, { key: 'K2', qty: 2, addedOn: FW.addDays(d, -100) }));
    await s.M.Variant.create(V(s.A, { key: 'K3', qty: 5, lastSoldOn: FW.addDays(d, -5) })); await s.M.Variant.create(V(s.A, { key: 'K4', qty: 0, lastSoldOn: FW.addDays(d, -200) }));
    const r = await call(s.router, 'GET', '/first-win', owner(s.A)); expect(r.body.data.mode).toBe('real'); expect(r.body.data.count).toBe(2); expect(r.body.data.rupees).toBe(900 + 1600);
    expect((await call(s.router, 'POST', '/setup/sample', owner(s.A))).code).toBe(400); expect((await call(s.router, 'GET', '/first-win', owner(s.B))).body.data.mode).toBe('sample');
  });
  test('checklist: ONE next action; manual steps only by key', async () => {
    const s = await setup(); expect((await call(s.router, 'GET', '/setup', owner(s.A))).body.data.next.key).toBe('variants_added');
    await s.M.Variant.create(V(s.A, { key: 'K1', qty: 1 })); expect((await call(s.router, 'GET', '/setup', owner(s.A))).body.data.next.key).toBe('first_bill');
    expect((await call(s.router, 'POST', '/setup/steps/:key/done', { ...owner(s.A), params: { key: 'variants_added' } })).code).toBe(400);
    expect((await call(s.router, 'POST', '/setup/steps/:key/done', { ...owner(s.A), params: { key: 'suggestion_viewed' } })).code).toBe(200);
    expect((await call(s.router, 'GET', '/setup', owner(s.B))).body.data.percent).toBe(0);
  });
});
