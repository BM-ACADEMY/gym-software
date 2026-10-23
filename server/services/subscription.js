const { getPlan, GRACE_DAYS, TRIAL_DAYS, TRIAL_PLAN_KEY } = require('../config/plans');

const DAY = 24 * 60 * 60 * 1000;

// Status is always COMPUTED from dates, never stored, so it cannot go stale.
//   suspended - Root Admin switched the gym off
//   trial     - inside the free trial, no payment yet
//   active    - paid up (or a legacy pilot gym with no billing dates)
//   grace     - paid period ended less than GRACE_DAYS ago, full access + warning
//   expired   - trial or paid period over: read-only until they pay
const computeStatus = (subscriber, now = new Date()) => {
  if (!subscriber) return { status: 'expired', readOnly: true };
  const t = now.getTime();

  if (subscriber.isActive === false) {
    return { status: 'suspended', readOnly: true, planKey: subscriber.planKey || null };
  }

  const paidUntil = subscriber.paidUntil ? new Date(subscriber.paidUntil).getTime() : null;
  const trialEnds = subscriber.trialEndsAt ? new Date(subscriber.trialEndsAt).getTime() : null;

  if (paidUntil) {
    if (paidUntil > t) {
      return { status: 'active', readOnly: false, planKey: subscriber.planKey, endsAt: new Date(paidUntil), daysLeft: Math.ceil((paidUntil - t) / DAY) };
    }
    const graceEnds = paidUntil + GRACE_DAYS * DAY;
    if (t < graceEnds) {
      return { status: 'grace', readOnly: false, planKey: subscriber.planKey, endsAt: new Date(graceEnds), daysLeft: Math.ceil((graceEnds - t) / DAY) };
    }
    return { status: 'expired', readOnly: true, planKey: subscriber.planKey, endsAt: new Date(paidUntil) };
  }

  // Legacy paid gym (planStartedAt set before paidUntil existed): treat as active.
  if (subscriber.planStartedAt) {
    return { status: 'active', readOnly: false, planKey: subscriber.planKey || null, legacy: true };
  }

  if (trialEnds) {
    if (trialEnds > t) {
      return { status: 'trial', readOnly: false, planKey: TRIAL_PLAN_KEY, endsAt: new Date(trialEnds), daysLeft: Math.ceil((trialEnds - t) / DAY) };
    }
    return { status: 'expired', readOnly: true, planKey: TRIAL_PLAN_KEY, endsAt: new Date(trialEnds), trialExpired: true };
  }

  // No dates at all: legacy pilot gym created by Root Admin. Never locked.
  return { status: 'active', readOnly: false, planKey: subscriber.planKey || null, legacy: true };
};

// The plan config that applies right now, or null for legacy gyms that
// still use the old DB plan (platformPlanId).
const effectivePlan = (subscriber, now = new Date()) => {
  const s = computeStatus(subscriber, now);
  return s.planKey ? getPlan(s.planKey) : null;
};

const trialDates = (now = new Date()) => ({
  trialEndsAt: new Date(now.getTime() + TRIAL_DAYS * DAY),
});

module.exports = { computeStatus, effectivePlan, trialDates, DAY };
