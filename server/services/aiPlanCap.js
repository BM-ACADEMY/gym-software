// PRICE-01: monthly cap on AI workout/diet plan generations, per plan (cost model: docs/AI_COST_MODEL.md).
// Pure functions, no database. The controller counts this month's 'generate' audit rows and asks here.
// Legacy gyms (old DB plans) keep their old quota (req.planFeature.value); this file returns undefined for them.
const { effectivePlan } = require('./subscription');

// Number of generations allowed this month, or undefined when the gym is on the legacy plan system
// (or the plan has no cap defined), meaning "use the legacy rule".
const planGenerationLimit = (subscriber, now = new Date()) => {
  if (!subscriber || subscriber.platformPlanId) return undefined;
  const plan = effectivePlan(subscriber, now);
  if (!plan || typeof plan.aiPlansPerMonth !== 'number') return undefined;
  return plan.aiPlansPerMonth;
};

// limit: number | undefined, used: generations already made this month.
const checkGenerationQuota = (limit, used) => {
  if (limit === undefined || limit === null) return { allowed: true, limit: null, remaining: null };
  const remaining = Math.max(0, limit - used);
  if (used >= limit) {
    return { allowed: false, limit, remaining: 0, message: `Monthly AI plan generation limit reached (${limit}/mo). Upgrade your plan for more.` };
  }
  return { allowed: true, limit, remaining };
};

module.exports = { planGenerationLimit, checkGenerationQuota };
