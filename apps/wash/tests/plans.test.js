const { PLANS, checkCap, billingPlans, BILLING } = require('../src/plans');
describe('Wash draft plans (Assumption, not approved)', () => {
  test('three plans in whole rupees with INR; caps grow with the plan; no free WhatsApp in any plan', () => {
    expect(Object.keys(PLANS)).toEqual(['starter', 'growth', 'pro']);
    for (const p of Object.values(PLANS)) { expect(Number.isInteger(p.price)).toBe(true); expect(p.currency).toBe('INR'); expect(p.whatsappPerMonth).toBe(0); }
    expect(PLANS.growth.photosPerMonth > PLANS.starter.photosPerMonth).toBe(true); expect(PLANS.pro.passesActive > PLANS.growth.passesActive).toBe(true);
  });
  test('cap check reports left, refuses at the limit, and rejects unknown plan or kind', () => {
    expect(checkCap('starter', 'pass', 19)).toEqual({ ok: true, cap: 20, used: 19, left: 1 });
    expect(checkCap('starter', 'pass', 20).ok).toBe(false);
    let code = ''; try { checkCap('gold', 'pass', 0); } catch (e) { code = e.code; } expect(code).toBe('PLAN_UNKNOWN');
  });
  test('billing shape for the shared core: yearly is 10 months; trial 14 days on growth', () => {
    const b = billingPlans(); expect(b.starter.monthly).toBe(149); expect(b.starter.yearly).toBe(1490); expect(BILLING.trialDays).toBe(14); expect(BILLING.trialPlanKey).toBe('growth');
  });
});
