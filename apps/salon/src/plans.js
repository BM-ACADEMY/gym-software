'use strict';
// Draft Groom (Salon) plans. NOT approved (Tier 3): the shop ladder Rs 149 / 299 / 499 is the master-plan draft (Assumption)
// and needs the same floor-price cost check the gym had (SAL-P1) before any invite. Caps are Assumptions until real cost is seen.
// Prices are whole rupees excluding GST, with a currency code. Unlimited staff logins on every plan (the selling point).
const PLANS = {
  starter: { price: 149, currency: 'INR', staffLimit: null, whatsappPerMonth: 0, aiCallsPerMonth: 30 },
  growth:  { price: 299, currency: 'INR', staffLimit: null, whatsappPerMonth: 0, aiCallsPerMonth: 100 },
  pro:     { price: 499, currency: 'INR', staffLimit: null, whatsappPerMonth: 0, aiCallsPerMonth: 300 },
};
const KIND_FIELD = { ai: 'aiCallsPerMonth', whatsapp: 'whatsappPerMonth' };
function checkCap(plan, kind, used) {
  const p = PLANS[plan]; const f = KIND_FIELD[kind];
  if (!p || !f) { const e = new Error('unknown plan or kind'); e.code = 'PLAN_UNKNOWN'; throw e; }
  return { ok: used < p[f], cap: p[f], used, left: Math.max(0, p[f] - used) };
}
const billingPlans = () => Object.fromEntries(Object.entries(PLANS).map(([key, p]) => [key, { key, name: key[0].toUpperCase() + key.slice(1), monthly: p.price, yearly: p.price * 10, currency: p.currency }]));
const BILLING = { gstRate: 18, graceDays: 3, trialDays: 14, trialPlanKey: 'growth', ranks: { starter: 0, growth: 1, pro: 2 } };
module.exports = { PLANS, checkCap, billingPlans, BILLING };
