'use strict';
// DRAFT Mart plans and caps. ASSUMPTION, NOT APPROVED (Tier 3: MRT-P1 floor-price table pending, same method as the gym).
// Master-plan draft ladder is Rs 149 / 299 / 499 GST included; billing core adds 18% GST on top, so the stored prices
// below are the before-GST amounts that come to about those totals (127 + 18% = 150, 254 -> 300, 423 -> 499).
// Research note (SCOPE section 6): billing-only competitors cost Rs 0 to 5,400 a year, so a free entry tier with paid
// AI and WhatsApp is proposed but NOT built. Caps are guesses to be set from real cost per bill photo (vision) once a human runs one.
// WhatsApp is not included in any plan: prepaid packs only (packs not built yet), so nothing is sent from Mart yet.
const PLANS = {
  starter: { price: 127, currency: 'INR', billPhotosPerMonth: 15, aiCallsPerMonth: 30, whatsappPerMonth: 0 },
  growth: { price: 254, currency: 'INR', billPhotosPerMonth: 60, aiCallsPerMonth: 100, whatsappPerMonth: 0 },
  pro: { price: 423, currency: 'INR', billPhotosPerMonth: 150, aiCallsPerMonth: 300, whatsappPerMonth: 0 },
};
const KIND_FIELD = { billPhoto: 'billPhotosPerMonth', ai: 'aiCallsPerMonth', whatsapp: 'whatsappPerMonth' };
function checkCap(plan, kind, usedThisMonth) {
  const p = PLANS[plan]; const f = KIND_FIELD[kind];
  if (!p || !f) { const e = new Error('unknown plan or kind'); e.code = 'PLAN_UNKNOWN'; throw e; }
  const cap = p[f];
  return { ok: usedThisMonth < cap, cap, used: usedThisMonth, left: Math.max(0, cap - usedThisMonth) };
}
// Shape the shared billing core (packages/core-billing) wants. Yearly = 10 months, like the gym (Assumption).
const billingPlans = () => Object.fromEntries(Object.entries(PLANS).map(([key, p]) => [key, { key, name: key[0].toUpperCase() + key.slice(1), monthly: p.price, yearly: p.price * 10, currency: p.currency }]));
const BILLING = { gstRate: 18, graceDays: 3, trialDays: 14, trialPlanKey: 'growth', ranks: { starter: 0, growth: 1, pro: 2 } };
module.exports = { PLANS, checkCap, billingPlans, BILLING };
