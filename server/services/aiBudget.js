// Platform-wide AI money guard (SA-03, D-13, D-15). Cost is worked out from real tokens in AiUsage.
// When today's spend (IST day) reaches the daily budget, every AI call in every product stops and the
// built-in rule-based answers take over. Nothing breaks; it only gets cheaper.
const AiUsage = require('../models/AiUsage');
const SystemSettings = require('../models/SystemSettings');
const { istDayStart } = require('./automationRules');

const SETTING_KEY = 'ai_daily_budget_inr';
const DEFAULT_BUDGET_INR = 500; // assumption, shown in the Daily Brief; change in Root Admin
// USD per 1M tokens. Source: docs/AI_COST_MODEL.md. Unknown models are priced like mini (safe side).
const PRICES = {
  'gpt-5.4-nano': { in: 0.2, out: 1.25 },
  'gpt-5.4-mini': { in: 0.75, out: 4.5 },
  'gpt-5.6-terra': { in: 2, out: 12 },
};
const FALLBACK_PRICE = { in: 2, out: 12 };

const usdInr = () => { const v = Number(process.env.USD_INR); return v > 0 ? v : 88; };
const priceFor = (model) => PRICES[String(model || '').toLowerCase()] || FALLBACK_PRICE;
const costInr = (model, inTokens = 0, outTokens = 0) => {
  const p = priceFor(model);
  return ((inTokens * p.in + outTokens * p.out) / 1e6) * usdInr();
};

const getDailyBudget = async () => {
  const stored = await SystemSettings.getSetting(SETTING_KEY, null);
  const n = Number(stored);
  if (stored !== null && Number.isFinite(n) && n >= 0) return n;
  const env = Number(process.env.AI_DAILY_BUDGET_INR);
  return Number.isFinite(env) && env >= 0 && process.env.AI_DAILY_BUDGET_INR ? env : DEFAULT_BUDGET_INR;
};
const setDailyBudget = (n) => SystemSettings.setSetting(SETTING_KEY, n, 'Platform AI budget per day, rupees. 0 switches AI off everywhere.');

const spendSince = async (from, to = new Date()) => {
  const rows = await AiUsage.aggregate([
    { $match: { createdAt: { $gte: from, $lte: to } } },
    { $group: { _id: '$model', inTokens: { $sum: '$inTokens' }, outTokens: { $sum: '$outTokens' }, calls: { $sum: 1 } } },
  ]);
  return rows.reduce((s, r) => s + costInr(r._id, r.inTokens, r.outTokens), 0);
};

let cache = null;
const resetCache = () => { cache = null; };
const status = async (now = new Date()) => {
  if (cache && now.getTime() - cache.at < 30000 && cache.day === istDayStart(now).getTime()) return cache.value;
  const [budget, spent] = await Promise.all([getDailyBudget(), spendSince(istDayStart(now), now)]);
  const value = { budget, spent: Math.round(spent * 100) / 100, stopped: spent >= budget };
  cache = { at: now.getTime(), day: istDayStart(now).getTime(), value };
  return value;
};
const isStopped = async (now = new Date()) => {
  try { return (await status(now)).stopped; } catch (err) { console.warn('AI budget check failed, allowing:', err.message); return false; }
};

module.exports = { PRICES, costInr, getDailyBudget, setDailyBudget, spendSince, status, isStopped, resetCache, DEFAULT_BUDGET_INR };
