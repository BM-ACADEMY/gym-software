'use strict';
// Builds the Hire server. FAILS CLOSED: if a required setting is missing, every /api route answers 503 and nothing else runs.
// Required settings (server settings file only, never git): MONGODB_URI, HIRE_SESSION_SECRET (32+ characters).
// Optional: OPENAI_API_KEY + AI_PROVIDER (AI stays off without them), HIRE_DAILY_AI_BUDGET_INR (default 300, Assumption).
const { makeBilling } = require('../../../packages/core-billing/src');
const { billingPlans, BILLING } = require('./plans');
const makeModels = require('./models');
const { createHireRouter, createSharePublicRouter } = require('./routes');
const { createAuthRouter, sessionMiddleware } = require('./authRoutes');
const { createInternalRouter } = require('./internalRoutes');
const { runUnscoped } = require('../../../packages/core-server/src');

function missingSettings(env) {
  const out = [];
  if (!env.MONGODB_URI) out.push('MONGODB_URI');
  if (!env.HIRE_SESSION_SECRET || env.HIRE_SESSION_SECRET.length < 32) out.push('HIRE_SESSION_SECRET');
  return out;
}

function makeBudget(M, env, now = () => new Date()) {
  // Assumption: conservative flat prices per million tokens until a real parse is costed.
  const pin = Number(env.HIRE_AI_RS_PER_MTOK_IN) || 40; const pout = Number(env.HIRE_AI_RS_PER_MTOK_OUT) || 160;
  const daily = Number(env.HIRE_DAILY_AI_BUDGET_INR) || 300;
  return { isStopped: async () => {
    try {
      const d = now(); const start = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0) - 5.5 * 3600000);
      const rows = await runUnscoped('daily AI budget counts every agency together', () => M.UsageLog.aggregate([{ $match: { createdAt: { $gte: start } } }, { $group: { _id: null, i: { $sum: '$inTokens' }, o: { $sum: '$outTokens' } } }]));
      const r = rows[0] || { i: 0, o: 0 };
      return (r.i * pin + r.o * pout) / 1e6 >= daily;
    } catch (e) { console.warn('Hire AI budget check failed, AI kept off for safety'); return true; }
  } };
}

function createApp({ express, mongoose, env = process.env, ai }) {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '6mb' })); // resume upload arrives as base64
  const missing = missingSettings(env);
  app.get('/api/health', (req, res) => res.json({ ok: missing.length === 0 }));
  if (missing.length) { app.use('/api', (req, res) => res.status(503).json({ success: false, message: 'Hire is not set up yet.' })); return app; }

  const billing = makeBilling({ plans: billingPlans(), ...BILLING });
  const M = makeModels(mongoose);
  const secret = env.HIRE_SESSION_SECRET;
  app.use('/api/hire/auth', createAuthRouter({ express, mongoose, billing, secret, termsVersion: env.HIRE_TERMS_VERSION }));
  // Public client share page: token only, no sign-in.
  app.use('/api/hire-share', createSharePublicRouter({ express, mongoose }));
  app.use('/api/internal', createInternalRouter({ express, mongoose, billing, key: env.INTERNAL_API_KEY, dailyBudgetInr: Number(env.HIRE_DAILY_AI_BUDGET_INR) || 300 }));
  const protect = sessionMiddleware(secret, M);
  const authorize = (...roles) => (req, res, next) => (roles.includes(req.user && req.user.role) ? next() : res.status(403).json({ success: false, message: 'Not allowed.' }));
  app.use('/api/hire', createHireRouter({
    express, mongoose, protect, authorize,
    tenantOf: (req) => req.user.tenantId,
    planOf: (req) => billing.computeStatus(req.subscription).planKey,
    guardWrite: (req) => billing.guardWrite(req.subscription, req.method),
    ai, budget: makeBudget(M, env),
  }));
  return app;
}
module.exports = { createApp, missingSettings, makeBudget };
