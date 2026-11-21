const I = require('../src/internalRoutes'); const { makeBilling } = require('../../../packages/core-billing/src'); const { billingPlans, BILLING } = require('../src/plans');
const billing = makeBilling({ plans: billingPlans(), ...BILLING });
const now = new Date('2026-11-12T08:00:00Z'); const d = (n) => new Date(now.getTime() + n * 86400000);
describe('internal summary (counts only)', () => {
  test('key check: unset, short, wrong and right keys', () => {
    expect(I.keyOk('x', undefined)).toBe(false); expect(I.keyOk('short', 'short')).toBe(false); expect(I.keyOk('a'.repeat(24), 'b'.repeat(24))).toBe(false); expect(I.keyOk('a'.repeat(24), 'a'.repeat(24))).toBe(true);
  });
  test('summary counts trial, paying and ending soon, and carries no customer data', () => {
    const tenants = [
      { _id: '1', businessName: 'Shine', createdAt: d(-2), trialEndsAt: d(2) },
      { _id: '2', businessName: 'Old', createdAt: d(-60), trialEndsAt: d(-40) },
      { _id: '3', businessName: 'Paid', createdAt: d(-30), trialEndsAt: d(-16), paidUntil: d(20), planKey: 'growth', billingCycle: 'monthly', planStartedAt: d(-10) },
    ];
    const s = I.shapeSummary({ tenants, billing, active7dTenantIds: ['1', '3', '3'], now });
    expect(s.product).toBe('wash'); expect(s.schema).toBe(1); expect(s.businesses.total).toBe(3); expect(s.businesses.trial).toBe(1); expect(s.businesses.paying).toBe(1); expect(s.businesses.expired).toBe(1);
    expect(s.businesses.signups7d).toBe(1); expect(s.businesses.active7d).toBe(2); expect(s.mrr).toBeGreaterThan(0); expect(s.endingSoon[0]).toEqual({ name: 'Shine', kind: 'trial', daysLeft: 2 });
    expect(JSON.stringify(s).match(/phone|plate|owner/i)).toBe(null);
  });
  test('router answers 401 without the key and the summary with it; reads every business but returns counts only', async () => {
    const h = {}; const router = { use: (f) => (h.use = f), get: (p, f) => (h['GET ' + p] = f) };
    const M = { Tenant: { find: () => ({ limit: () => ({ lean: async () => [{ _id: '1', businessName: 'Shine', createdAt: d(-2), trialEndsAt: d(2) }] }) }) }, User: { distinct: async () => ['1'] } };
    I.createInternalRouter({ express: { Router: () => router }, models: M, billing, key: 'k'.repeat(30) });
    let out; h.use({ headers: {} }, { status: (c) => ({ json: (b) => { out = { c, b }; } }) }, () => { out = 'next'; }); expect(out.c).toBe(401);
    h.use({ headers: { 'x-internal-key': 'k'.repeat(30) } }, {}, () => { out = 'next'; }); expect(out).toBe('next');
    await h['GET /admin-summary']({}, { set: () => {}, json: (b) => { out = b; } }); expect(out.data.businesses.total).toBe(1); expect(out.data.businesses.active7d).toBe(1);
  });
});
