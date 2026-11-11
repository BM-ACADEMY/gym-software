'use strict';
// SET-01: saves plan changes in the database (SystemSettings, key "planOverrides") and keeps the live PLANS in step.
// Every change needs a written reason and is kept in a history list (who, when, what, why). Fail safe: if the database
// read fails the code defaults stay in force.
const po = require('./planOverrides');
const KEY = 'planOverrides';
const MAX_HISTORY = 100;

function makeStore({ SystemSettings, PLANS, now = () => new Date() }) {
  po.snapshotDefaults(PLANS);
  let state = { overrides: {}, history: [] };
  const read = async () => { const v = await SystemSettings.getSetting(KEY, null); return v && typeof v === 'object' ? { overrides: v.overrides || {}, history: Array.isArray(v.history) ? v.history : [] } : { overrides: {}, history: [] }; };
  const write = async () => { await SystemSettings.setSetting(KEY, state, 'Plan prices and limits changed by the owner (Root Admin > Plan Settings)'); po.applyOverrides(PLANS, state.overrides); };
  const reasonOk = (r) => typeof r === 'string' && r.trim().length >= 5 && r.trim().length <= 200;
  return {
    load: async () => { try { state = await read(); po.applyOverrides(PLANS, state.overrides); return true; } catch (e) { console.error('plan overrides not loaded, code defaults stay:', e.message); return false; } },
    view: () => ({ plans: Object.values(PLANS).map((p) => ({ ...p, defaults: po.defaultsOf(p.key), changed: Object.keys(state.overrides[p.key] || {}) })), floors: po.FLOORS, history: state.history.slice(-50).reverse() }),
    save: async (planKey, patch, who, reason, confirmBelowFloor) => {
      if (!reasonOk(reason)) return { error: 'Write the reason for this change (5 to 200 characters)' };
      const cur = PLANS[planKey]; const v = po.validatePatch(planKey, patch, cur); if (v.error) return { error: v.error };
      if (v.warnings.some((w) => w.code === 'below_floor') && confirmBelowFloor !== true) return { needsConfirm: true, warnings: v.warnings };
      const before = {}; for (const k of Object.keys(v.value)) before[k] = cur[k];
      state = { overrides: { ...state.overrides, [planKey]: { ...(state.overrides[planKey] || {}), ...v.value } }, history: [...state.history, { at: now().toISOString(), by: String(who || 'unknown').slice(0, 60), plan: planKey, action: 'change', before, after: v.value, reason: reason.trim() }].slice(-MAX_HISTORY) };
      await write(); return { ok: true, warnings: v.warnings };
    },
    reset: async (planKey, who, reason) => {
      if (!reasonOk(reason)) return { error: 'Write the reason for this change (5 to 200 characters)' };
      if (!PLANS[planKey]) return { error: 'Unknown plan' };
      const { [planKey]: dropped, ...rest } = state.overrides;
      state = { overrides: rest, history: [...state.history, { at: now().toISOString(), by: String(who || 'unknown').slice(0, 60), plan: planKey, action: 'reset', before: dropped || {}, after: {}, reason: reason.trim() }].slice(-MAX_HISTORY) };
      await write(); return { ok: true };
    },
  };
}
module.exports = { makeStore, KEY };
