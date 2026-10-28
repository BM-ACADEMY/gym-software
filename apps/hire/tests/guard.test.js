const { makeBilling } = require('../../../packages/core-billing/src');
const { createHireRouter } = require('../src/routes');
const B = makeBilling({ plans: { a: { key: 'a', monthly: 1, yearly: 10, limits: {} } }, gstRate: 18, graceDays: 3, trialDays: 14, trialPlanKey: 'a', ranks: { a: 0 } });
function run(sub, method) {
  let mw = []; const router = { use: (...f) => mw.push(...f), get() {}, post() {}, put() {}, patch() {}, delete() {} };
  const mongoose = { Schema: class { constructor() {} index() {} }, models: {}, model: () => ({}), Types: { ObjectId: String } };
  mongoose.Schema.Types = { ObjectId: String, Mixed: {} };
  createHireRouter({ express: { Router: () => router }, mongoose, protect: 1, authorize: () => 2, tenantOf: () => 't', planOf: () => 'a', guardWrite: (req) => B.guardWrite(sub, req.method) });
  const guard = mw[mw.length - 1]; let out = {}; let nexted = false;
  guard({ method }, { status: (c) => ({ json: (b) => { out = { c, b }; } }) }, () => { nexted = true; });
  return { out, nexted };
}
describe('Hire read-only guard', () => {
  test('expired: write blocked with 402, read allowed', () => {
    const e = { trialEndsAt: new Date(Date.now() - 86400000) };
    const w = run(e, 'POST'); expect(w.nexted).toBe(false); expect(w.out.c).toBe(402); expect(w.out.b.code).toBe('read_only');
    expect(run(e, 'GET').nexted).toBe(true);
  });
  test('trial: write allowed', () => { expect(run({ trialEndsAt: new Date(Date.now() + 86400000) }, 'POST').nexted).toBe(true); });
});
