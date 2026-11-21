'use strict';
// SET-01: plans, prices and limits the owner can change from Root Admin without a deploy.
// The code in config/plans.js stays the safe default. Saved changes ("overrides") are laid over it, in place, so every
// place that already reads PLANS sees the new value. Pure functions: no database here (see planSettingsStore.js).

const PRICE_FIELDS = ['monthly', 'yearly'];
const LIMIT_FIELDS = ['memberLimit', 'staffLimit']; // null means unlimited
const COUNT_FIELDS = ['whatsappPerMonth', 'aiCallsPerMonth', 'aiPlansPerMonth'];
const FEATURE_KEYS = ['ai-plans', 'pt-sessions', 'accounts', 'branding'];
// Monthly full-use floors (docs/AI_COST_MODEL.md: 25% margin, every cap fully used). Below this needs an explicit confirm.
const FLOORS = { solo: 380, starter: 489, growth: 804, pro: 1599 };
const MAX_PRICE = 100000, MAX_COUNT = 1000000;

const isInt = (v) => typeof v === 'number' && Number.isInteger(v);
const pickKeys = (o, keys) => keys.reduce((a, k) => (Object.prototype.hasOwnProperty.call(o, k) ? { ...a, [k]: o[k] } : a), {});

// patch: { monthly, yearly, memberLimit, staffLimit, whatsappPerMonth, aiCallsPerMonth, aiPlansPerMonth, features:{...} }
// current: the plan as it is now. Returns { value } (clean patch) plus { warnings }, or { error }.
function validatePatch(planKey, patch, current) {
  if (!current) return { error: 'Unknown plan' };
  if (!patch || typeof patch !== 'object' || Array.isArray(patch)) return { error: 'Nothing to change' };
  const known = [...PRICE_FIELDS, ...LIMIT_FIELDS, ...COUNT_FIELDS, 'features'];
  const bad = Object.keys(patch).filter((k) => !known.includes(k));
  if (bad.length) return { error: `Cannot change: ${bad.join(', ')}` };
  const out = {}; const warnings = [];
  for (const f of PRICE_FIELDS) if (f in patch) {
    if (!isInt(patch[f]) || patch[f] < 0 || patch[f] > MAX_PRICE) return { error: `${f} must be a whole rupee amount from 0 to ${MAX_PRICE}` };
    out[f] = patch[f];
  }
  for (const f of LIMIT_FIELDS) if (f in patch) {
    const v = patch[f];
    if (v !== null && (!isInt(v) || v < 1 || v > MAX_COUNT)) return { error: `${f} must be a whole number of 1 or more, or empty for unlimited` };
    out[f] = v;
  }
  for (const f of COUNT_FIELDS) if (f in patch) {
    if (!isInt(patch[f]) || patch[f] < 0 || patch[f] > MAX_COUNT) return { error: `${f} must be a whole number from 0 to ${MAX_COUNT}` };
    out[f] = patch[f];
  }
  if ('features' in patch) {
    const f = patch.features;
    if (!f || typeof f !== 'object' || Array.isArray(f)) return { error: 'features must be a list of on/off switches' };
    for (const k of Object.keys(f)) {
      if (!FEATURE_KEYS.includes(k)) return { error: `Unknown feature: ${k}` };
      if (typeof f[k] !== 'boolean') return { error: `Feature ${k} must be on or off` };
    }
    out.features = { ...current.features, ...f };
  }
  if (!Object.keys(out).length) return { error: 'Nothing to change' };
  const monthly = 'monthly' in out ? out.monthly : current.monthly;
  const yearly = 'yearly' in out ? out.yearly : current.yearly;
  if (yearly < monthly) return { error: 'The yearly price cannot be below the monthly price' };
  if (FLOORS[planKey] && monthly < FLOORS[planKey] && planKey !== 'solo' && 'monthly' in out) warnings.push({ code: 'below_floor', floor: FLOORS[planKey], message: `Monthly price Rs ${monthly} is below the full-use floor of Rs ${FLOORS[planKey]}. A gym that uses every cap would cost more than it pays.` });
  if (yearly > monthly * 12) warnings.push({ code: 'yearly_dear', message: 'The yearly price is more than 12 monthly payments.' });
  return { value: out, warnings };
}

const SNAPSHOT = {};
// Remember the code defaults the first time, so a reset always goes back to them.
function snapshotDefaults(PLANS) { for (const k of Object.keys(PLANS)) if (!SNAPSHOT[k]) SNAPSHOT[k] = JSON.parse(JSON.stringify(PLANS[k])); return SNAPSHOT; }
const defaultsOf = (planKey) => (SNAPSHOT[planKey] ? JSON.parse(JSON.stringify(SNAPSHOT[planKey])) : null);

// Lay overrides over the defaults and write the result into the live PLANS objects (same object identity).
function applyOverrides(PLANS, overrides) {
  snapshotDefaults(PLANS);
  for (const k of Object.keys(PLANS)) {
    const base = defaultsOf(k); const o = (overrides && overrides[k]) || {};
    const clean = {};
    for (const f of [...PRICE_FIELDS, ...LIMIT_FIELDS, ...COUNT_FIELDS]) if (f in o) clean[f] = o[f];
    if (o.features && typeof o.features === 'object') clean.features = { ...base.features, ...pickKeys(o.features, FEATURE_KEYS) };
    Object.assign(PLANS[k], base, clean, { key: base.key, name: base.name, currency: base.currency });
  }
  return PLANS;
}

// What the public pricing page may see: no floors, no costs, no history.
const publicPlans = (PLANS, gstRate) => Object.values(PLANS).map((p) => ({
  key: p.key, name: p.name, currency: p.currency, monthly: p.monthly, yearly: p.yearly,
  memberLimit: p.memberLimit, staffLimit: p.staffLimit, whatsappPerMonth: p.whatsappPerMonth,
  aiCallsPerMonth: p.aiCallsPerMonth, aiPlansPerMonth: p.aiPlansPerMonth, features: p.features, gstRate,
}));

module.exports = { FLOORS, FEATURE_KEYS, validatePatch, applyOverrides, snapshotDefaults, defaultsOf, publicPlans };
