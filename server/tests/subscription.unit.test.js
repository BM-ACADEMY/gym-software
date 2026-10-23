// Pure unit tests: no database needed.
const { computeStatus, effectivePlan, trialDates, DAY } = require('../services/subscription');
const { priceFor, getPlan, TRIAL_DAYS } = require('../config/plans');

const now = new Date('2026-12-01T00:00:00Z');
const ago = (d) => new Date(now.getTime() - d * DAY);
const ahead = (d) => new Date(now.getTime() + d * DAY);

describe('subscription status from dates', () => {
  test('suspended wins over everything', () => {
    expect(computeStatus({ isActive: false, paidUntil: ahead(10) }, now).status).toBe('suspended');
  });
  test('inside trial is trial with Growth plan', () => {
    const s = computeStatus({ trialEndsAt: ahead(5) }, now);
    expect(s.status).toBe('trial');
    expect(s.readOnly).toBe(false);
    expect(effectivePlan({ trialEndsAt: ahead(5) }, now).key).toBe('growth');
  });
  test('trial over without payment is expired and read-only', () => {
    const s = computeStatus({ trialEndsAt: ago(1) }, now);
    expect(s.status).toBe('expired');
    expect(s.readOnly).toBe(true);
    expect(s.trialExpired).toBe(true);
  });
  test('paid in the future is active on the paid plan', () => {
    const sub = { planKey: 'starter', paidUntil: ahead(20), trialEndsAt: ago(30) };
    expect(computeStatus(sub, now).status).toBe('active');
    expect(effectivePlan(sub, now).key).toBe('starter');
  });
  test('paid period ended within 3 days is grace with full access', () => {
    const s = computeStatus({ planKey: 'pro', paidUntil: ago(2) }, now);
    expect(s.status).toBe('grace');
    expect(s.readOnly).toBe(false);
  });
  test('paid period ended more than 3 days ago is expired', () => {
    const s = computeStatus({ planKey: 'pro', paidUntil: ago(4) }, now);
    expect(s.status).toBe('expired');
    expect(s.readOnly).toBe(true);
  });
  test('legacy pilot gym with no dates is never locked', () => {
    const s = computeStatus({}, now);
    expect(s.status).toBe('active');
    expect(s.readOnly).toBe(false);
    expect(effectivePlan({}, now)).toBeNull();
  });
  test('trialDates gives a 14 day trial', () => {
    expect(trialDates(now).trialEndsAt.getTime() - now.getTime()).toBe(TRIAL_DAYS * DAY);
  });
});

describe('plan prices', () => {
  test('GST is 18% and rounded to whole rupees', () => {
    expect(priceFor('growth', 'monthly')).toEqual({ base: 999, gst: 180, total: 1179, currency: 'INR' });
    expect(priceFor('starter', 'yearly').total).toBe(5999 + Math.round(5999 * 0.18));
  });
  test('unknown plan or cycle returns null', () => {
    expect(priceFor('gold', 'monthly')).toBeNull();
    expect(priceFor('pro', 'weekly')).toBeNull();
  });
  test('yearly is cheaper than 12 months for every plan', () => {
    for (const k of ['starter', 'growth', 'pro']) {
      const p = getPlan(k);
      expect(p.yearly).toBeLessThan(p.monthly * 12);
    }
  });
});
