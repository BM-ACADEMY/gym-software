const { planGenerationLimit, checkGenerationQuota } = require('../services/aiPlanCap');
const { PLANS } = require('../config/plans');

const paid = (planKey) => ({ planKey, paidUntil: new Date(Date.now() + 10 * 86400000) });

describe('AI plan generation cap (PRICE-01, pure)', () => {
  test('plans define a cap; Solo and Starter cannot generate (feature off anyway)', () => {
    expect(PLANS.solo.aiPlansPerMonth).toBe(0);
    expect(PLANS.starter.aiPlansPerMonth).toBe(0);
    expect(PLANS.growth.aiPlansPerMonth).toBe(30);
    expect(PLANS.pro.aiPlansPerMonth).toBe(100);
  });
  test('limit comes from the gym plan', () => {
    expect(planGenerationLimit(paid('growth'))).toBe(30);
    expect(planGenerationLimit(paid('pro'))).toBe(100);
  });
  test('a trial gym is treated as Growth', () => {
    const trial = { trialEndsAt: new Date(Date.now() + 5 * 86400000) };
    expect(planGenerationLimit(trial)).toBe(30);
  });
  test('legacy gyms (old DB plan) get undefined so the old rule applies', () => {
    expect(planGenerationLimit({ platformPlanId: 'abc', planKey: 'growth', paidUntil: new Date(Date.now() + 86400000) })).toBeUndefined();
    expect(planGenerationLimit(null)).toBeUndefined();
  });
  test('quota check allows below the cap and blocks at the cap', () => {
    expect(checkGenerationQuota(30, 29)).toMatchObject({ allowed: true, remaining: 1 });
    expect(checkGenerationQuota(30, 30)).toMatchObject({ allowed: false, remaining: 0 });
    expect(checkGenerationQuota(30, 45).allowed).toBe(false);
    expect(checkGenerationQuota(0, 0).allowed).toBe(false);
  });
  test('no limit means allowed', () => {
    expect(checkGenerationQuota(undefined, 999).allowed).toBe(true);
  });
});
