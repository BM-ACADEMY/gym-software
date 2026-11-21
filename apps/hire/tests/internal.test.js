const { shapeSummary, shapeAccount, keyOk } = require('../src/internalRoutes');
const { makeBilling } = require('../../../packages/core-billing/src'); const { billingPlans, BILLING } = require('../src/plans');
const billing = makeBilling({ plans: billingPlans(), ...BILLING }); const now = new Date('2026-11-10T06:00:00Z'); const d = (n) => new Date(now.getTime() + n * 86400000);
const tenants = [{ agencyName: 'Sri Staffing', createdAt: d(-2), trialEndsAt: d(2) }, { agencyName: 'Paid One', createdAt: d(-60), paidUntil: d(5), planKey: 'growth', billingCycle: 'monthly' }, { agencyName: 'Gone', createdAt: d(-90), trialEndsAt: d(-30) }];
describe('Hire internal routes', () => {
  test('summary follows contract v1', () => {
    const s = shapeSummary({ tenants, billing, aiCallsToday: 3, aiCostTodayInr: 12.5, budgetInr: 300, now });
    expect(s.schema).toBe(1); expect(s.product).toBe('hire'); expect(s.businesses.total).toBe(3); expect(s.businesses.trial).toBe(1); expect(s.businesses.paying).toBe(1); expect(s.businesses.expired).toBe(1); expect(s.businesses.signups7d).toBe(1);
    expect(s.mrr).toBe(1999); expect(s.endingSoon[0].name).toBe('Sri Staffing'); expect(s.renewalsDue[0].daysLeft).toBe(5); expect(s.ai.stopped).toBe(false);
    const { cleanSummary } = require('../../admin/src/aggregate'); expect(cleanSummary(s, 'hire').businesses.total).toBe(3); // the Super Admin accepts it
  });
  test('account facts: consent only when exactly true', () => {
    const a = shapeAccount({ tenant: tenants[0], owner: { name: 'Ravi', email: 'r@x.com', phone: '9876543210', salesContactOk: true }, billing, now });
    expect(a.contactConsent).toBe(true); expect(a.status.status).toBe('trial'); expect(Object.keys(a).join()).toBe('product,businessName,ownerName,ownerPhone,ownerEmail,contactConsent,createdAt,lastActiveAt,status');
    expect(shapeAccount({ tenant: tenants[0], owner: { name: 'R', salesContactOk: 1 }, billing, now }).contactConsent).toBe(false);
  });
  test('key check', () => { const k = 'k'.repeat(30); expect(keyOk(k, k)).toBe(true); expect(keyOk('x'.repeat(30), k)).toBe(false); expect(keyOk('', k)).toBe(false); expect(keyOk(k, 'short')).toBe(false); expect(keyOk(k, undefined)).toBe(false); });
});
