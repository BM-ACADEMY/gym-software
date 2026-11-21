const P = require('../src/plans');
const { makeBilling } = require('../../../packages/core-billing/src');
describe('Mart draft plans (Assumption, not approved)', () => {
  test('three plans, before-GST prices that come to about 149 / 299 / 499 with 18% GST', () => {
    expect(Object.keys(P.PLANS)).toEqual(['starter', 'growth', 'pro']);
    const total = (k) => Math.round(P.PLANS[k].price * 1.18);
    expect(total('starter')).toBe(150); expect(total('growth')).toBe(300); expect(total('pro')).toBe(499);
  });
  test('whole rupees with a currency code; WhatsApp is not included in any plan', () => {
    for (const p of Object.values(P.PLANS)) { expect(Number.isInteger(p.price)).toBe(true); expect(p.currency).toBe('INR'); expect(p.whatsappPerMonth).toBe(0); }
  });
  test('caps rise with the plan; cap check reports left and refuses at the cap', () => {
    expect(P.PLANS.pro.billPhotosPerMonth > P.PLANS.growth.billPhotosPerMonth).toBe(true);
    expect(P.checkCap('starter', 'billPhoto', 14).ok).toBe(true);
    expect(P.checkCap('starter', 'billPhoto', 15).ok).toBe(false);
    expect(P.checkCap('starter', 'ai', 10).left).toBe(20);
    let code = ''; try { P.checkCap('nope', 'ai', 0); } catch (e) { code = e.code; } expect(code).toBe('PLAN_UNKNOWN');
  });
  test('billing core accepts the plans: trial runs on growth, read-only after the trial', () => {
    const b = makeBilling({ plans: P.billingPlans(), ...P.BILLING });
    const now = new Date('2026-11-12T06:00:00Z'); const t = b.computeStatus({ trialEndsAt: new Date(now.getTime() + 86400000) }, now);
    expect(t.status).toBe('trial'); expect(t.planKey).toBe('growth');
    expect(b.computeStatus({ trialEndsAt: new Date(now.getTime() - 86400000 * 10) }, now).readOnly).toBe(true);
  });
});
