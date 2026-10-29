'use strict';
// Decides, BEFORE any AI call, whether a public visitor may use AI right now. No network, no database: the store is passed in.
// Order: cached answer (free) -> money stop -> per-user daily limit -> per-IP daily limit -> allow.
// A "no" is never an error for the visitor: the site shows its normal result without AI feedback (see FALLBACK_TEXT).
const crypto = require('crypto');
const DEFAULTS = { perUserPerDay: 3, perIpPerDay: 20, cacheDays: 30 };
const FALLBACK_TEXT = { budget: 'AI feedback is resting for today. Your score is saved. Please try again tomorrow.', user_limit: 'You have used today\'s AI feedback. Your score is saved. Come back tomorrow for more.', ip_limit: 'Too many requests from this network today. Your score is saved. Please try again tomorrow.', not_signed_in: 'Please sign in to get AI feedback.' };

const istDay = (now) => new Date(now.getTime() + 5.5 * 3600000).toISOString().slice(0, 10);
// Same answer text (ignoring case, spaces and punctuation) to the same question and marking version gives the same cache key.
const cacheKey = ({ assessmentId, questionId, answer, version = 'v1' }) => crypto.createHash('sha256').update([assessmentId, questionId, version, String(answer || '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim()].join('|')).digest('hex');
const ipKey = (ip) => crypto.createHash('sha256').update(String(ip || 'unknown')).digest('hex').slice(0, 24); // never store the raw address

// store: { get(k), incr(k, day) -> new count, cacheGet(k), cacheSet(k, value, days), spendToday() -> {costInr, budgetInr} }
function createGuard({ store, limits = {}, now = () => new Date() }) {
  const L = { ...DEFAULTS, ...limits };
  async function check({ userId, ip, cacheParts }) {
    if (!userId) return { allow: false, reason: 'not_signed_in', message: FALLBACK_TEXT.not_signed_in };
    const ck = cacheParts ? cacheKey(cacheParts) : null;
    if (ck) { const hit = await store.cacheGet(ck); if (hit != null) return { allow: false, cached: true, value: hit, reason: 'cached' }; }
    const sp = await store.spendToday();
    if (sp.costInr >= sp.budgetInr) return { allow: false, reason: 'budget', message: FALLBACK_TEXT.budget, cacheKey: ck };
    const day = istDay(now());
    const uk = `u:${userId}:${day}`; const ik = `i:${ipKey(ip)}:${day}`;
    if ((await store.get(uk)) >= L.perUserPerDay) return { allow: false, reason: 'user_limit', message: FALLBACK_TEXT.user_limit, cacheKey: ck };
    if ((await store.get(ik)) >= L.perIpPerDay) return { allow: false, reason: 'ip_limit', message: FALLBACK_TEXT.ip_limit, cacheKey: ck };
    return { allow: true, cacheKey: ck, userKey: uk, ipKey: ik };
  }
  // Call after the AI call has been made (success or not: we may have paid). Saves the answer for next time when given.
  async function record(decision, { value } = {}) {
    await store.incr(decision.userKey, istDay(now())); await store.incr(decision.ipKey, istDay(now()));
    if (decision.cacheKey && value != null) await store.cacheSet(decision.cacheKey, value, L.cacheDays);
  }
  return { check, record, limits: L };
}
// Simple in-memory store for tests and a single small server. Resets on restart, so use a database store in production.
function memoryStore({ budgetInr = 50, costInr = 0 } = {}) {
  const counts = new Map(); const cache = new Map(); const spend = { costInr, budgetInr };
  return { counts, cache, spend, get: async (k) => counts.get(k) || 0, incr: async (k) => { counts.set(k, (counts.get(k) || 0) + 1); return counts.get(k); }, cacheGet: async (k) => (cache.has(k) ? cache.get(k) : null), cacheSet: async (k, v) => { cache.set(k, v); }, spendToday: async () => spend };
}
module.exports = { createGuard, memoryStore, cacheKey, ipKey, istDay, FALLBACK_TEXT, DEFAULTS };
