const path = require('path');
const po = require('../services/planOverrides');
const { makeStore } = require('../services/planSettingsStore');
const fresh = () => ({ solo: { key: 'solo', name: 'Solo', currency: 'INR', monthly: 249, yearly: 2490, memberLimit: 50, staffLimit: 1, features: { 'ai-plans': false, 'pt-sessions': false, accounts: false, branding: false }, whatsappPerMonth: 0, aiCallsPerMonth: 15, aiPlansPerMonth: 0 },
  growth: { key: 'growth', name: 'Growth', currency: 'INR', monthly: 999, yearly: 9999, memberLimit: 500, staffLimit: 5, features: { 'ai-plans': true, 'pt-sessions': true, accounts: true, branding: false }, whatsappPerMonth: 1000, aiCallsPerMonth: 120, aiPlansPerMonth: 30 } });
const mem = () => { let v = null; return { getSetting: async () => v, setSetting: async (k, val) => { v = JSON.parse(JSON.stringify(val)); } }; };
describe('plan overrides (SET-01)', () => {
  test('validation: whole rupees, limits, features, unknown fields', () => {
    const P = fresh(); const cur = P.growth;
    expect(po.validatePatch('growth', { monthly: 12.5 }, cur).error).toMatch(/whole rupee/);
    expect(po.validatePatch('growth', { monthly: -1 }, cur).error).toMatch(/whole rupee/);
    expect(po.validatePatch('growth', { memberLimit: 0 }, cur).error).toMatch(/1 or more/);
    expect(po.validatePatch('growth', { memberLimit: null }, cur).value.memberLimit).toBe(null);
    expect(po.validatePatch('growth', { name: 'Gold' }, cur).error).toMatch(/Cannot change/);
    expect(po.validatePatch('growth', { features: { magic: true } }, cur).error).toMatch(/Unknown feature/);
    expect(po.validatePatch('growth', { features: { branding: 'yes' } }, cur).error).toMatch(/on or off/);
    expect(po.validatePatch('growth', {}, cur).error).toMatch(/Nothing/);
    expect(po.validatePatch('nope', { monthly: 1 }, null).error).toMatch(/Unknown plan/);
    expect(po.validatePatch('growth', { yearly: 500 }, cur).error).toMatch(/yearly price cannot be below/);
  });
  test('below the floor is a warning that needs a confirm; solo is exempt', () => {
    const P = fresh();
    const w = po.validatePatch('growth', { monthly: 700, yearly: 7000 }, P.growth);
    expect(w.warnings[0].code).toBe('below_floor'); expect(w.warnings[0].floor).toBe(804);
    expect(po.validatePatch('solo', { monthly: 200, yearly: 2000 }, P.solo).warnings.length).toBe(0);
    expect(po.validatePatch('growth', { monthly: 900, yearly: 9000 }, P.growth).warnings.length).toBe(0);
  });
  test('applyOverrides changes the live object in place and a reset restores the code default', () => {
    const P = fresh(); const same = P.growth;
    po.applyOverrides(P, { growth: { monthly: 1099, features: { branding: true } } });
    expect(P.growth).toBe(same); expect(P.growth.monthly).toBe(1099); expect(P.growth.features.branding).toBe(true); expect(P.growth.features['ai-plans']).toBe(true); expect(P.growth.name).toBe('Growth');
    po.applyOverrides(P, {}); expect(P.growth.monthly).toBe(999); expect(P.growth.features.branding).toBe(false);
  });
  test('public plans carry no floors, history or costs', () => {
    const P = fresh(); const pub = po.publicPlans(P, 18);
    expect(pub.length).toBe(2); expect(Object.keys(pub[0]).sort()).toEqual(['aiCallsPerMonth', 'aiPlansPerMonth', 'currency', 'features', 'gstRate', 'key', 'memberLimit', 'monthly', 'name', 'staffLimit', 'whatsappPerMonth', 'yearly']);
  });
  test('store: reason needed, below-floor needs confirm, change is saved, logged and reloads; reset goes back', async () => {
    const P = fresh(); const db = mem(); const s = makeStore({ SystemSettings: db, PLANS: P, now: () => new Date('2026-11-12T05:00:00Z') });
    expect((await s.save('growth', { monthly: 1099 }, 'owner@x', '', false)).error).toMatch(/reason/);
    const need = await s.save('growth', { monthly: 700, yearly: 7000 }, 'owner@x', 'launch test price', false);
    expect(need.needsConfirm).toBe(true); expect(P.growth.monthly).toBe(999);
    expect((await s.save('growth', { monthly: 700, yearly: 7000 }, 'owner@x', 'launch test price', true)).ok).toBe(true); expect(P.growth.monthly).toBe(700);
    expect((await s.save('growth', { monthly: 1099, yearly: 10999 }, 'owner@x', 'raise price', false)).ok).toBe(true); expect(P.growth.monthly).toBe(1099);
    const v = s.view(); expect(v.history.length).toBe(3 - 1); expect(v.history[0].reason).toBe('raise price'); expect(v.history[0].before.monthly).toBe(700);
    const P2 = fresh(); const s2 = makeStore({ SystemSettings: db, PLANS: P2 }); await s2.load(); expect(P2.growth.monthly).toBe(1099);
    expect((await s.reset('growth', 'owner@x', 'back to default')).ok).toBe(true); expect(P.growth.monthly).toBe(999);
    expect((await s.reset('growth', 'owner@x', 'x')).error).toMatch(/reason/);
  });
  test('a failing database read keeps the code defaults', async () => {
    const P = fresh(); const s = makeStore({ SystemSettings: { getSetting: async () => { throw new Error('db down'); }, setSetting: async () => {} }, PLANS: P });
    expect(await s.load()).toBe(false); expect(P.growth.monthly).toBe(999);
  });
});

describe('trial length (SET-01)', () => {
  const { getTrialDays, setTrialDays, TRIAL_DAYS } = require('../config/plans');
  const { makeStore } = require('../services/planSettingsStore');
  const { PLANS } = require('../config/plans');
  test('live value follows the saved setting; bad values fall back to the default', async () => {
    let saved = null;
    const SystemSettings = { getSetting: async () => saved, setSetting: async (k, v) => { saved = v; } };
    const st = makeStore({ SystemSettings, PLANS });
    expect((await st.saveTrial(7, 'o', 'no')).error).toMatch(/reason/i);
    expect((await st.saveTrial(120, 'o', 'too long a trial')).error).toMatch(/0 to 90/);
    expect((await st.saveTrial(7, 'o', 'shorter trial test')).ok).toBe(true);
    expect(getTrialDays()).toBe(7); expect(st.view().trial.days).toBe(7);
    expect(saved.history[saved.history.length - 1].after.trialDays).toBe(7);
    setTrialDays(-3); expect(getTrialDays()).toBe(TRIAL_DAYS);
    const st2 = makeStore({ SystemSettings, PLANS }); await st2.load(); expect(getTrialDays()).toBe(7);
    setTrialDays(TRIAL_DAYS);
  });
});
