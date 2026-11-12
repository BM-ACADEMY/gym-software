const { call, fakeMongoose, fakeRouter } = require('../../../packages/core-pos/tests/fakeMongoose'); const makeModels = require('../src/models');
const { firstWin: FW } = require('../../../packages/core-pos/src'); const { makeConfig } = require('../src/firstWin');
async function setup() {
  const { mongoose } = fakeMongoose(); const M = makeModels(mongoose); const ex = { Router: () => fakeRouter() };
  const router = FW.createFirstWinRouter({ express: ex, mongoose, protect: (q, s, n) => n(), tenantOf: (r) => r.user.tenantId, config: makeConfig(M) });
  return { M, router, A: 'a'.repeat(24), B: 'b'.repeat(24) };
}
const owner = (t) => ({ user: { tenantId: t, role: 'admin', email: 'o@x.in' } }); const att = (t) => ({ user: { tenantId: t, role: 'attendant' } });
describe('Wash first win and set-up checklist', () => {
  test('owner only; sample label when no records', async () => {
    const s = await setup(); expect((await call(s.router, 'GET', '/first-win', att(s.A))).code).toBe(403); expect((await call(s.router, 'POST', '/setup/sample', att(s.A))).code).toBe(403);
    const r = await call(s.router, 'GET', '/first-win', owner(s.A)); expect(r.body.data.mode).toBe('sample'); expect(r.body.data.label).toMatch(/Sample/);
  });
  test('sample on and off in one tap; nothing left; other centre untouched', async () => {
    const s = await setup(); await s.M.Vehicle.create({ tenantId: s.B, plate: 'TN01AB1234', klass: 'sedan', lastWash: '2026-01-01' });
    expect((await call(s.router, 'POST', '/setup/sample', owner(s.A))).code).toBe(200); expect((await s.M.Job.find({ tenantId: s.A }).lean()).length).toBe(3);
    expect((await call(s.router, 'GET', '/setup', owner(s.A))).body.data.steps.find((x) => x.key === 'first_job').done).toBe(false);
    expect((await call(s.router, 'POST', '/setup/sample/remove', owner(s.A))).code).toBe(200);
    expect((await s.M.Job.find({ tenantId: s.A }).lean()).length).toBe(0); expect((await s.M.Vehicle.find({ tenantId: s.A }).lean()).length).toBe(0); expect((await s.M.Vehicle.find({ tenantId: s.B }).lean()).length).toBe(1);
  });
  test('real: quiet vehicles from their own lastWash; rupees = own average delivered job; opted-out left out', async () => {
    const s = await setup(); const d = FW.istToday();
    await s.M.Vehicle.create({ tenantId: s.A, plate: 'V1', klass: 'sedan', lastWash: FW.addDays(d, -45) }); await s.M.Vehicle.create({ tenantId: s.A, plate: 'V2', klass: 'sedan', lastWash: FW.addDays(d, -45), doNotContact: true });
    await s.M.Vehicle.create({ tenantId: s.A, plate: 'V3', klass: 'sedan', lastWash: FW.addDays(d, -2) });
    await s.M.Job.create({ tenantId: s.A, plate: 'V3', state: 'delivered', total: 400, day: d }); await s.M.Job.create({ tenantId: s.A, plate: 'V3', state: 'delivered', total: 200, day: d });
    const r = await call(s.router, 'GET', '/first-win', owner(s.A)); expect(r.body.data.mode).toBe('real'); expect(r.body.data.count).toBe(1); expect(r.body.data.rupees).toBe(300);
    expect((await call(s.router, 'POST', '/setup/sample', owner(s.A))).code).toBe(400); expect((await call(s.router, 'GET', '/first-win', owner(s.B))).body.data.mode).toBe('sample');
  });
  test('checklist: ONE next action; manual steps only by key', async () => {
    const s = await setup(); expect((await call(s.router, 'GET', '/setup', owner(s.A))).body.data.next.key).toBe('price_list_set');
    await s.M.PriceList.create({ tenantId: s.A, prices: { sedan: { basic: 300 } } }); expect((await call(s.router, 'GET', '/setup', owner(s.A))).body.data.next.key).toBe('attendant_added');
    expect((await call(s.router, 'POST', '/setup/steps/:key/done', { ...owner(s.A), params: { key: 'price_list_set' } })).code).toBe(400);
    expect((await call(s.router, 'POST', '/setup/steps/:key/done', { ...owner(s.A), params: { key: 'suggestion_viewed' } })).code).toBe(200);
    expect((await call(s.router, 'GET', '/setup', owner(s.B))).body.data.percent).toBe(0);
  });
});
