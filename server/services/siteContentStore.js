'use strict';
// D-28: saves site wording in the database (SystemSettings key "siteContent") and keeps a history (who, when, what, why).
// Fail safe: if the database read fails, the code defaults stay in force. Same pattern as planSettingsStore.js.
const sc = require('./siteContent');
const KEY = 'siteContent';
const MAX_HISTORY = 100;

function makeStore({ SystemSettings, now = () => new Date() }) {
  let state = { overrides: {}, history: [] };
  const read = async () => { const v = await SystemSettings.getSetting(KEY, null); return v && typeof v === 'object' ? { overrides: v.overrides && typeof v.overrides === 'object' ? v.overrides : {}, history: Array.isArray(v.history) ? v.history : [] } : { overrides: {}, history: [] }; };
  const write = async () => { await SystemSettings.setSetting(KEY, state, 'Site wording changed by the owner (Root Admin > Site content)'); };
  const reasonOk = (r) => typeof r === 'string' && r.trim().length >= 5 && r.trim().length <= 200;
  const who = (w) => String(w || 'unknown').slice(0, 60);
  const log = (h) => [...state.history, h].slice(-MAX_HISTORY);
  return {
    load: async () => { try { state = await read(); return true; } catch (e) { console.error('site content not loaded, code defaults stay:', e.message); return false; } },
    live: () => sc.merge(state.overrides),
    publicView: (vars) => sc.forPublic(sc.merge(state.overrides), vars),
    view: () => ({ content: sc.merge(state.overrides), defaults: sc.DEFAULTS, changed: sc.SECTIONS.filter((s) => s in state.overrides), history: state.history.slice(-50).reverse(), limits: { text: sc.TEXT_FIELDS, list: sc.LIST_LIMITS } }),
    save: async (section, value, by, reason) => {
      if (!reasonOk(reason)) return { error: 'Write the reason for this change (5 to 200 characters)' };
      const v = sc.validateSection(section, value); if (v.error) return { error: v.error };
      const before = sc.merge(state.overrides)[section];
      state = { overrides: { ...state.overrides, [section]: v.value }, history: log({ at: now().toISOString(), by: who(by), section, action: 'change', before, after: v.value, reason: reason.trim() }) };
      await write(); return { ok: true };
    },
    reset: async (section, by, reason) => {
      if (!reasonOk(reason)) return { error: 'Write the reason for this change (5 to 200 characters)' };
      if (!sc.SECTIONS.includes(section)) return { error: 'Unknown section' };
      const { [section]: dropped, ...rest } = state.overrides;
      state = { overrides: rest, history: log({ at: now().toISOString(), by: who(by), section, action: 'reset', before: dropped === undefined ? sc.DEFAULTS[section] : dropped, after: sc.DEFAULTS[section], reason: reason.trim() }) };
      await write(); return { ok: true };
    },
  };
}
module.exports = { makeStore, KEY };
