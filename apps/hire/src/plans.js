'use strict';
// Draft Hire plans and AI caps. NOT approved (Tier 3, HIR-P1 floor-price table pending). Caps are Assumptions
// to be checked against real token cost per resume once a human runs a parse with a real key.
const PLANS = {
  starter: { price: 999, currency: 'INR', parsesPerMonth: 150, rankRunsPerMonth: 100, outreachPerMonth: 300 },
  growth:  { price: 1999, currency: 'INR', parsesPerMonth: 600, rankRunsPerMonth: 400, outreachPerMonth: 1200 },
  pro:     { price: 3999, currency: 'INR', parsesPerMonth: 2000, rankRunsPerMonth: 1500, outreachPerMonth: 4000 },
};
const KIND_FIELD = { parse: 'parsesPerMonth', rank: 'rankRunsPerMonth', outreach: 'outreachPerMonth' };
function checkCap(plan, kind, usedThisMonth) {
  const p = PLANS[plan]; const f = KIND_FIELD[kind];
  if (!p || !f) { const e = new Error('unknown plan or kind'); e.code = 'PLAN_UNKNOWN'; throw e; }
  const cap = p[f];
  return { ok: usedThisMonth < cap, cap, used: usedThisMonth, left: Math.max(0, cap - usedThisMonth) };
}
module.exports = { PLANS, checkCap };
