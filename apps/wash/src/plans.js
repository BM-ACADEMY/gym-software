'use strict';
// DRAFT Wash plans. NOT approved (Tier 3: WSH-P1 floor-price table pending, must include photo storage cost).
// ASSUMPTION: Rs 149 / 299 / 499 comes from the master-plan shop ladder (docs/products/wash/SCOPE.md section 6). It is NOT decided
// whether these are before or after 18% GST; the code below treats them as before GST, like the gym and Hire. Owner to confirm.
// ASSUMPTION: every cap below is a guess to be checked against real storage and AI cost from the first pilot washes.
const PLANS = {
  starter: { price: 149, currency: 'INR', photosPerMonth: 100, aiCallsPerMonth: 20, whatsappPerMonth: 0, passesActive: 20 },
  growth: { price: 299, currency: 'INR', photosPerMonth: 400, aiCallsPerMonth: 80, whatsappPerMonth: 0, passesActive: 100 },
  pro: { price: 499, currency: 'INR', photosPerMonth: 1500, aiCallsPerMonth: 250, whatsappPerMonth: 0, passesActive: 500 },
};
// whatsappPerMonth 0 = no free WhatsApp in any plan (prepaid packs, same rule as Hire). Suggestions only until packs exist.
const FIELD = { photo: 'photosPerMonth', ai: 'aiCallsPerMonth', whatsapp: 'whatsappPerMonth', pass: 'passesActive' };
function checkCap(plan, kind, used) {
  const p = PLANS[plan]; const f = FIELD[kind];
  if (!p || !f) { const e = new Error('unknown plan or kind'); e.code = 'PLAN_UNKNOWN'; throw e; }
  const cap = p[f];
  return { ok: used < cap, cap, used, left: Math.max(0, cap - used) };
}
const billingPlans = () => Object.fromEntries(Object.entries(PLANS).map(([key, p]) => [key, { key, name: key[0].toUpperCase() + key.slice(1), monthly: p.price, yearly: p.price * 10, currency: p.currency }]));
const BILLING = { gstRate: 18, graceDays: 3, trialDays: 14, trialPlanKey: 'growth', ranks: { starter: 0, growth: 1, pro: 2 } };
module.exports = { PLANS, checkCap, billingPlans, BILLING };
