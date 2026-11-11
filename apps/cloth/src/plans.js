'use strict';
// Draft Cloth plans. ASSUMPTION, NOT APPROVED (Tier 3, CLO-P1 floor-price table pending; shop ladder needs the same cost check as the gym, D-10).
// Prices are whole rupees per month, GST extra here (the master-plan draft says GST included: decide before launch). Caps are guesses to tune from real cost.
const PLANS = {
  starter: { price: 149, currency: 'INR', variantsMax: 500, staffMax: 1, aiCallsPerMonth: 30, whatsappPerMonth: 0 },
  growth: { price: 299, currency: 'INR', variantsMax: 3000, staffMax: 4, aiCallsPerMonth: 120, whatsappPerMonth: 0 },
  pro: { price: 499, currency: 'INR', variantsMax: 20000, staffMax: 15, aiCallsPerMonth: 300, whatsappPerMonth: 0 },
};
const billingPlans = () => Object.fromEntries(Object.entries(PLANS).map(([key, p]) => [key, { key, name: key[0].toUpperCase() + key.slice(1), monthly: p.price, yearly: p.price * 10, currency: p.currency }]));
const BILLING = { gstRate: 18, graceDays: 3, trialDays: 14, trialPlanKey: 'growth', ranks: { starter: 0, growth: 1, pro: 2 } };
const withinCap = (planKey, field, used) => { const p = PLANS[planKey]; if (!p || p[field] == null) return { ok: false, cap: 0 }; return { ok: used < p[field], cap: p[field], used }; };
module.exports = { PLANS, billingPlans, BILLING, withinCap };
