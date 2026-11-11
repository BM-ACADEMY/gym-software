const DP = require('../src/discountPolicy'); const L = require('../src/leaks'); const S = require('../src/summary');
const { discountGuard } = require('../src/routes');
describe('staff discount rule (D-30)', () => {
  test('default: staff up to 10 percent, owner never limited, exact share not rounded', () => {
    expect(DP.normalize(undefined)).toEqual({ staff: 'limit', maxPercent: 10 });
    expect(DP.check({ role: 'staff', discount: 50, subtotal: 500 }).ok).toBe(true);
    expect(DP.check({ role: 'staff', discount: 52, subtotal: 500 }).ok).toBe(false);
    expect(DP.check({ role: 'admin', discount: 400, subtotal: 500, rule: { staff: 'owner_only' } }).ok).toBe(true);
  });
  test('owner_only refuses staff; any allows; bad rule falls back to default', () => {
    expect(DP.check({ role: 'staff', discount: 1, subtotal: 500, rule: { staff: 'owner_only' } }).ok).toBe(false);
    expect(DP.check({ role: 'staff', discount: 450, subtotal: 500, rule: { staff: 'any' } }).ok).toBe(true);
    expect(DP.normalize({ staff: 'weird', maxPercent: 500 })).toEqual({ staff: 'limit', maxPercent: 10 });
  });
  test('owner sees staff discounts grouped per day; owner discounts left out; shows in the daily summary', () => {
    const rows = [{ day: '2026-11-12', role: 'staff', amount: 40, percent: 8 }, { day: '2026-11-12', role: 'staff', amount: 30, percent: 6 }, { day: '2026-11-12', role: 'owner', amount: 900, percent: 50 }];
    const r = L.staffDiscounts(rows);
    expect(r.length).toBe(1); expect(r[0].count).toBe(2); expect(r[0].total).toBe(70); expect(r[0].maxPercent).toBe(8); expect(r[0].reason).toMatch(/staff gave 2 discounts worth 70 rupees/);
    expect(S.dailySummary({ bills: [], staffDiscounts: r }).staffDiscounts.length).toBe(1);
  });
});
// The guard runs before the shared bill route. Fake models: one item (Rs 500), settings, and a recorder.
function harness({ role, rule, body }) {
  const made = []; const models = {};
  const q = (v) => ({ lean: async () => v });
  const mongoose = { models, Types: { ObjectId: function (v) { this.v = v; } }, Schema: class { index() {} plugin() {} }, model: (n) => models[n] };
  mongoose.Schema.Types = { ObjectId: 'oid', Mixed: 'mixed' };
  const reg = (n, o) => { models[n] = o; };
  reg('PosItem', { findOne: () => q({ _id: 'a'.repeat(24), name: 'Rice', price: 500, gstRate: 0 }) });
  reg('MartSettings', { findOne: () => q(rule ? { discountRule: rule } : null) });
  reg('MartBillDiscount', { create: async (d) => { made.push(['discount', d]); } });
  reg('MartActivity', { create: async (d) => { made.push(['activity', d]); } });
  return { mongoose, made, req: { method: 'POST', path: '/bills', body, user: { id: 'u1', role } } };
}
async function run(h) {
  const g = discountGuard({ mongoose: h.mongoose, tenantOf: () => 't1', now: () => new Date('2026-11-12T06:00:00Z') });
  let status = 200; let out; let nexted = false;
  const res = { status(c) { status = c; return this; }, json(b) { out = b; return this; } };
  await g(h.req, res, () => { nexted = true; });
  return { res, status: () => status, out: () => out, nexted: () => nexted };
}
describe('discount guard on the bill route', () => {
  const body = (value, reason = 'regular customer') => ({ lines: [{ itemId: 'a'.repeat(24), qty: 1 }], billDiscount: { type: 'amount', value }, discountReason: reason });
  test('staff over the default 10 percent is refused with the rule message', async () => {
    const r = await run(harness({ role: 'subadmin', body: body(100) })); expect(r.nexted()).toBe(false); expect(r.status()).toBe(403); expect(r.out().code).toBe('discount_rule');
  });
  test('a discount needs a reason', async () => {
    const r = await run(harness({ role: 'subadmin', body: body(10, '') })); expect(r.status()).toBe(400); expect(r.out().code).toBe('discount_reason');
  });
  test('staff within the limit passes and the saved bill is recorded with who and the percent', async () => {
    const h = harness({ role: 'subadmin', body: body(50) }); const r = await run(h); expect(r.nexted()).toBe(true);
    await new Promise((ok) => { const orig = r.res.json; r.res.json({ success: true, data: { _id: 'b1', number: 'MART/1' } }); setTimeout(ok, 10); });
    const d = h.made.find((x) => x[0] === 'discount')[1]; expect(d.role).toBe('staff'); expect(d.percent).toBe(10); expect(d.amount).toBe(50); expect(d.day).toBe('2026-11-12');
    expect(h.made.find((x) => x[0] === 'activity')[1].text).toMatch(/Staff gave 10% off \(50 rupees\) on bill MART\/1/);
  });
  test('owner is never limited; owner_only rule stops staff; a bill without discount passes untouched', async () => {
    expect((await run(harness({ role: 'admin', rule: { staff: 'owner_only' }, body: body(400) }))).nexted()).toBe(true);
    expect((await run(harness({ role: 'subadmin', rule: { staff: 'owner_only' }, body: body(1) }))).status()).toBe(403);
    expect((await run(harness({ role: 'subadmin', body: { lines: [{ itemId: 'a'.repeat(24), qty: 1 }] } }))).nexted()).toBe(true);
  });
});
