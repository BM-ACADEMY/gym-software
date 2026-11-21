// Proves the shared billing gives the SAME answers as the gym's own billing code, so the gym can switch to it later.
const { makeBilling, addPeriod, fyOf, invoiceNumber, gstModeFor } = require('../src');
const gymPlans = require('../../../server/config/plans');
const gymMath = require('../../../server/services/billingMath');
const gymSub = require('../../../server/services/subscription');

const B = makeBilling({ plans: gymPlans.PLANS, gstRate: gymPlans.GST_RATE, graceDays: gymPlans.GRACE_DAYS, trialDays: gymPlans.TRIAL_DAYS, trialPlanKey: gymPlans.TRIAL_PLAN_KEY, ranks: gymMath.RANK });
const now = new Date('2026-11-10T06:00:00Z'); const d = (n) => new Date(now.getTime() + n * 86400000);

describe('parity with the gym billing code', () => {
  test('status for every kind of account', () => {
    const subs = [null, { isActive: false, planKey: 'solo' }, { paidUntil: d(10), planKey: 'starter' }, { paidUntil: d(-1), planKey: 'starter' }, { paidUntil: d(-20), planKey: 'starter' },
      { trialEndsAt: d(5) }, { trialEndsAt: d(-1) }, { planStartedAt: d(-90), planKey: 'growth' }, {}];
    subs.forEach((s) => expect(JSON.stringify(B.computeStatus(s, now))).toBe(JSON.stringify(gymSub.computeStatus(s, now))));
  });
  test('quotes with credit, promo and both GST modes', () => {
    for (const plan of ['solo', 'starter', 'growth', 'pro']) for (const cycle of ['monthly', 'yearly']) for (const gstMode of ['cgst_sgst', 'igst'])
      for (const extra of [{}, { creditRupees: 300 }, { discountPercent: 20 }, { creditRupees: 99999, discountPercent: 100 }])
        expect(JSON.stringify(B.quote({ plan, cycle, gstMode, ...extra }))).toBe(JSON.stringify(gymMath.quote({ plan, cycle, gstMode, ...extra })));
  });
  test('purchase rules, proration, periods, financial year, invoice number, GST mode', () => {
    const st = B.computeStatus({ paidUntil: d(10), planKey: 'starter' }, now);
    for (const newPlan of ['solo', 'starter', 'growth']) expect(JSON.stringify(B.purchaseRule({ status: st, currentPlan: 'starter', currentCycle: 'monthly', paidUntil: d(10), newPlan, now }))).toBe(JSON.stringify(gymMath.purchaseRule({ status: st, currentPlan: 'starter', currentCycle: 'monthly', paidUntil: d(10), newPlan, now })));
    expect(B.prorationCredit({ plan: 'growth', cycle: 'monthly', paidUntil: d(10), now })).toBe(gymMath.prorationCredit({ plan: 'growth', cycle: 'monthly', paidUntil: d(10), now }));
    expect(addPeriod('2026-01-31T00:00:00Z', 'monthly').toISOString()).toBe(gymMath.addPeriod('2026-01-31T00:00:00Z', 'monthly').toISOString());
    expect(fyOf('2027-03-31T20:00:00Z')).toBe(gymMath.fyOf('2027-03-31T20:00:00Z')); expect(invoiceNumber('AV', '2026-27', 7)).toBe(gymMath.invoiceNumber('AV', '2026-27', 7));
    expect(gstModeFor('puducherry', ' Puducherry ')).toBe(gymMath.gstModeFor('puducherry', ' Puducherry ')); expect(gstModeFor('', 'Puducherry')).toBe('igst');
  });
});
describe('limits and write guard', () => {
  const P = makeBilling({ plans: { a: { key: 'a', monthly: 100, yearly: 1000, limits: { candidates: 2, rank: null } } }, gstRate: 18, graceDays: 3, trialDays: 14, trialPlanKey: 'a', ranks: { a: 0 } });
  test('limit check', () => { expect(P.checkLimit('a', 'candidates', 1).ok).toBe(true); expect(P.checkLimit('a', 'candidates', 2).ok).toBe(false); expect(P.checkLimit('a', 'rank', 9999).ok).toBe(true); expect(P.checkLimit('zzz', 'candidates', 0).ok).toBe(false); });
  test('expired accounts are read-only but can still read', () => {
    const expired = { trialEndsAt: d(-5) };
    expect(P.guardWrite(expired, 'POST', now).ok).toBe(false); expect(P.guardWrite(expired, 'POST', now).httpStatus).toBe(402); expect(P.guardWrite(expired, 'GET', now).ok).toBe(true);
    expect(P.guardWrite({ trialEndsAt: d(5) }, 'POST', now).ok).toBe(true); expect(P.guardWrite({ isActive: false }, 'DELETE', now).message).toMatch(/suspended/);
  });
  test('new trial ends in 14 days', () => { expect(P.trialDates(now).trialEndsAt.getTime()).toBe(now.getTime() + 14 * 86400000); });
});
