const { shapeSummary, keyOk } = require('../src/internalRoutes');
const { makeBilling } = require('../../../packages/core-billing/src'); const { billingPlans, BILLING } = require('../src/plans');
const billing = makeBilling({ plans: billingPlans(), ...BILLING }); const now = new Date('2026-11-10T06:00:00Z'); const d = (n) => new Date(now.getTime() + n * 86400000);
const tenants = [{ shopName: 'Sri Cloth', createdAt: d(-2), trialEndsAt: d(2) }, { shopName: 'Paid One', createdAt: d(-60), paidUntil: d(5), planKey: 'growth', billingCycle: 'monthly' }, { shopName: 'Gone', createdAt: d(-90), trialEndsAt: d(-60) }];
describe('Cloth internal summary (counts only)', () => {
  test('follows contract v1 and carries no customer or owner contact data', () => {
    const s = shapeSummary({ tenants, billing, aiCallsToday: 3, aiCostTodayInr: 12.5, budgetInr: 300, now });
    expect(s.schema).toBe(1); expect(s.product).toBe('cloth'); expect(s.businesses.total).toBe(3); expect(s.businesses.trial).toBe(1); expect(s.businesses.paying).toBe(1); expect(s.businesses.expired).toBe(1); expect(s.businesses.signups7d).toBe(1);
    expect(s.mrr > 0).toBe(true); expect(s.endingSoon[0].name).toBe('Sri Cloth'); expect(s.ai.stopped).toBe(false); expect(s.currency).toBe('INR');
    expect(JSON.stringify(s)).not.toMatch(/phone|email|owner|customer/i);
    const { cleanSummary } = require('../../admin/src/aggregate'); expect(cleanSummary(s, 'cloth').businesses.total).toBe(3); // the Super Admin accepts it
  });
  test('AI budget stop shows; the key check refuses wrong, empty and short keys', () => {
    expect(shapeSummary({ tenants, billing, aiCallsToday: 1, aiCostTodayInr: 400, budgetInr: 300, now }).ai.stopped).toBe(true);
    const k = 'k'.repeat(30); expect(keyOk(k, k)).toBe(true); expect(keyOk('x'.repeat(30), k)).toBe(false); expect(keyOk('', k)).toBe(false); expect(keyOk(k, 'short')).toBe(false);
  });
});
