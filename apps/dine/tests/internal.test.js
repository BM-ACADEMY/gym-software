const { shapeSummary, keyOk } = require('../src/internalRoutes');
const { makeBilling } = require('../../../packages/core-billing/src'); const { billingPlans, BILLING } = require('../src/plans');
const billing = makeBilling({ plans: billingPlans(), ...BILLING }); const now = new Date('2026-11-10T06:00:00Z'); const d = (n) => new Date(now.getTime() + n * 86400000);
const tenants = [{ venueName: 'Sri Cafe', createdAt: d(-2), trialEndsAt: d(2) }, { venueName: 'Paid One', createdAt: d(-60), paidUntil: d(5), planKey: 'growth', billingCycle: 'monthly' }, { venueName: 'Gone', createdAt: d(-90), trialEndsAt: d(-60) }];
describe('Dine internal summary (counts only)', () => {
  test('follows contract v1, carries no guest or owner contact data, and the Super Admin accepts it', () => {
    const s = shapeSummary({ tenants, billing, active7dTenantIds: ['a', 'a', 'b'], now });
    expect(s.schema).toBe(1); expect(s.product).toBe('dine'); expect(s.businesses.total).toBe(3); expect(s.businesses.trial).toBe(1); expect(s.businesses.paying).toBe(1); expect(s.businesses.expired).toBe(1); expect(s.businesses.signups7d).toBe(1); expect(s.businesses.active7d).toBe(2);
    expect(s.mrr > 0).toBe(true); expect(s.endingSoon[0].name).toBe('Sri Cafe'); expect(s.currency).toBe('INR');
    expect(JSON.stringify(s)).not.toMatch(/phone|email|owner|guest|customer/i);
    const { cleanSummary } = require('../../admin/src/aggregate'); expect(cleanSummary(s, 'dine').businesses.total).toBe(3);
  });
  test('key check refuses wrong, empty, short and missing keys', async () => {
    const k = 'k'.repeat(30); expect(keyOk(k, k)).toBe(true); expect(keyOk('x'.repeat(30), k)).toBe(false); expect(keyOk('', k)).toBe(false); expect(keyOk(k, 'short')).toBe(false); expect(keyOk(k, undefined)).toBe(false);
  });
});
