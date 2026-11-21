'use strict';
// DRAFT Dine plans. NOT approved (Tier 3). Assumption: ladder follows the master-plan shop band (Rs 499 restaurant figure) and must pass a
// floor-price check (task DIN-P1) before anyone is charged. Petpooja renewal is about Rs 583 a month (source: scope section 7), so the
// price is shown against it honestly. WhatsApp sends are NOT included in any plan (prepaid packs only, as for Hire).
const PLANS = {
  starter: { price: 299, currency: 'INR', tables: 10, staffLogins: 3, aiCallsPerMonth: 60, pubMode: false },
  growth:  { price: 499, currency: 'INR', tables: 30, staffLogins: 10, aiCallsPerMonth: 200, pubMode: false },
  pro:     { price: 899, currency: 'INR', tables: 100, staffLogins: 30, aiCallsPerMonth: 600, pubMode: true },
};
const checkLimit = (plan, field, used) => { const p = PLANS[plan]; if (!p || p[field] === undefined) { const e = new Error('unknown plan or limit'); e.code = 'PLAN_UNKNOWN'; throw e; } return { ok: used < p[field], cap: p[field], used, left: Math.max(0, p[field] - used) }; };
const billingPlans = () => Object.fromEntries(Object.entries(PLANS).map(([key, p]) => [key, { key, name: key[0].toUpperCase() + key.slice(1), monthly: p.price, yearly: p.price * 10, currency: p.currency }]));
const BILLING = { gstRate: 18, graceDays: 3, trialDays: 14, trialPlanKey: 'growth', ranks: { starter: 0, growth: 1, pro: 2 } };
module.exports = { PLANS, checkLimit, billingPlans, BILLING };
