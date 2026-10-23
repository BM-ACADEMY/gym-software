// Code-defined SaaS plans. This is the single source of truth for prices,
// limits and features (replaces the DB-driven PlatformPlan/PlanFeature for
// new gyms; legacy pilot gyms that still have platformPlanId keep working).
// Prices are whole rupees EXCLUDING GST. Yearly = 10 months.
// Change a price here, deploy, done.

const GST_RATE = 18;
const GRACE_DAYS = 3;
const TRIAL_DAYS = 14;
const TRIAL_PLAN_KEY = 'growth'; // trial gets Growth features and limits

const PLANS = {
  starter: {
    key: 'starter',
    name: 'Starter',
    currency: 'INR',
    monthly: 599,
    yearly: 5999,
    memberLimit: 150,
    staffLimit: 2,
    features: { 'ai-plans': false, 'pt-sessions': false, accounts: false, branding: false },
    whatsappPerMonth: 300,
  },
  growth: {
    key: 'growth',
    name: 'Growth',
    currency: 'INR',
    monthly: 999,
    yearly: 9999,
    memberLimit: 500,
    staffLimit: 5,
    features: { 'ai-plans': true, 'pt-sessions': true, accounts: true, branding: false },
    whatsappPerMonth: 1000,
  },
  pro: {
    key: 'pro',
    name: 'Pro',
    currency: 'INR',
    monthly: 1999,
    yearly: 19999,
    memberLimit: null, // unlimited
    staffLimit: null,
    features: { 'ai-plans': true, 'pt-sessions': true, accounts: true, branding: true },
    whatsappPerMonth: 3000,
  },
};

const getPlan = (key) => PLANS[key] || null;
const listPlans = () => Object.values(PLANS);

// cycle: 'monthly' | 'yearly'. Returns { base, gst, total } in whole rupees.
const priceFor = (planKey, cycle) => {
  const plan = PLANS[planKey];
  if (!plan || !['monthly', 'yearly'].includes(cycle)) return null;
  const base = plan[cycle];
  const gst = Math.round((base * GST_RATE) / 100);
  return { base, gst, total: base + gst, currency: plan.currency };
};

module.exports = { PLANS, GST_RATE, GRACE_DAYS, TRIAL_DAYS, TRIAL_PLAN_KEY, getPlan, listPlans, priceFor };
