const DP = require('../src/discountPolicy'); const L = require('../src/leaks'); const S = require('../src/summary');
const { discountHooks } = require('../src/routes');
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
// The shared bill route calls these hooks (POS-01). Fake models: settings and the two recorders.
function harness({ rule }) {
  const made = []; const models = {};
  const q = (v) => ({ lean: async () => v });
  const mongoose = { models, Types: { ObjectId: function (v) { this.v = v; } }, Schema: class { index() {} plugin() {} }, model: (n) => models[n] };
  mongoose.Schema.Types = { ObjectId: 'oid', Mixed: 'mixed' };
  models.MartSettings = { findOne: () => q(rule ? { discountRule: rule } : null) };
  models.MartBillDiscount = { create: async (d) => { made.push(['discount', d]); } };
  models.MartActivity = { create: async (d) => { made.push(['activity', d]); } };
  return { mongoose, made };
}
const calcOf = (d) => ({ discount: d, subtotal: 500 });
const before = async (h, role, c, reason) => { try { return { r: await h.beforeBill({ req: { user: { id: 'u1', role } }, tid: 't1', body: { discountReason: reason }, calc: c }) }; } catch (e) { return { code: e.code, msg: e.message }; } };
describe('discount hooks on the shared bill route', () => {
  test('staff over the default 10 percent is refused (403-type) with the rule message', async () => {
    const r = await before(discountHooks(harness({})), 'subadmin', calcOf(100), 'regular customer'); expect(r.code).toBe('BILL_FORBIDDEN'); expect(r.msg).toMatch(/up to 10%/);
  });
  test('a discount needs a reason', async () => { expect((await before(discountHooks(harness({})), 'subadmin', calcOf(10), '')).code).toBe('BILL_INVALID'); });
  test('staff within the limit passes; the bill fields say who and the percent; after the save Mart records it', async () => {
    const h = harness({}); const hk = discountHooks({ mongoose: h.mongoose, now: () => new Date('2026-11-12T06:00:00Z') });
    const r = await before(hk, 'subadmin', calcOf(50), 'regular customer'); expect(r.r.fields.discountBy).toBe('staff'); expect(r.r.fields.discountPercent).toBe(10);
    await hk.afterBill({ req: { user: { id: 'u1' } }, tid: 't1', doc: { _id: 'b1', number: 'MART/1', ...r.r.fields }, calc: calcOf(50) });
    const d = h.made.find((x) => x[0] === 'discount')[1]; expect(d.role).toBe('staff'); expect(d.percent).toBe(10); expect(d.amount).toBe(50); expect(d.day).toBe('2026-11-12');
    expect(h.made.find((x) => x[0] === 'activity')[1].text).toMatch(/Staff gave 10% off \(50 rupees\) on bill MART\/1/);
  });
  test('owner is never limited; owner_only stops staff; a bill without discount passes untouched', async () => {
    expect((await before(discountHooks(harness({ rule: { staff: 'owner_only' } })), 'admin', calcOf(400), 'festival')).r.fields.discountBy).toBe('owner');
    expect((await before(discountHooks(harness({ rule: { staff: 'owner_only' } })), 'subadmin', calcOf(1), 'regular customer')).code).toBe('BILL_FORBIDDEN');
    expect((await before(discountHooks(harness({})), 'subadmin', calcOf(0), '')).r).toEqual({ fields: {} });
  });
});
