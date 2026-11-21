// Code-defined SaaS plans. This is the single source of truth for prices,
// limits and features (replaces the DB-driven PlatformPlan/PlanFeature for
// new gyms; legacy pilot gyms that still have platformPlanId keep working).
// aiCallsPerMonth caps the Ask GymDesk assistant + dashboard insights (a guess, tune from real cost).
// aiPlansPerMonth caps AI workout/diet plan generations (PRICE-01; 30 and 100 are the numbers the
// cost model in docs/AI_COST_MODEL.md assumes. Proposed, needs Mohamed's OK because it is a plan limit).
// Prices are whole rupees EXCLUDING GST. Yearly = 10 months.
// Change a price here, deploy, done.

const GST_RATE = 18;
const GRACE_DAYS = 3;
const TRIAL_DAYS = 14; // code default; the owner can change the live value (SET-01, getTrialDays)
const TRIAL = { days: TRIAL_DAYS };
const getTrialDays = () => TRIAL.days;
const setTrialDays = (n) => { TRIAL.days = Number.isInteger(n) && n >= 0 && n <= 90 ? n : TRIAL_DAYS; return TRIAL.days; };
const TRIAL_PLAN_KEY = 'growth'; // trial gets Growth features and limits

const PLANS = {
  solo: {
    key: 'solo',
    name: 'Solo',
    currency: 'INR',
    monthly: 249,
    yearly: 2490,
    memberLimit: 50,
    staffLimit: 1,
    features: { 'ai-plans': false, 'pt-sessions': false, accounts: false, branding: false },
    whatsappPerMonth: 0, // no WhatsApp: every message costs us money
    aiCallsPerMonth: 15,
    aiPlansPerMonth: 0,
  },
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
    aiCallsPerMonth: 40,
    aiPlansPerMonth: 0,
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
    aiCallsPerMonth: 120,
    aiPlansPerMonth: 30,
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
    aiCallsPerMonth: 300,
    aiPlansPerMonth: 100,
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

module.exports = { PLANS, GST_RATE, GRACE_DAYS, TRIAL_DAYS, getTrialDays, setTrialDays, TRIAL_PLAN_KEY, getPlan, listPlans, priceFor };
