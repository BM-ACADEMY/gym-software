'use strict';
// Builds the Mart server. FAILS CLOSED: if a required setting is missing, every /api route answers 503 and nothing else runs.
// Required settings (server settings file only, never git): MONGODB_URI, MART_SESSION_SECRET (32+ characters).
const { makeBilling } = require('../../../packages/core-billing/src');
const createPosRouter = require('../../../packages/core-pos/src/routes');
const { billingPlans, BILLING } = require('./plans');
const makeModels = require('./models');
const { createMartRouter, creditGuard, discountHooks } = require('./routes');
const { createAuthRouter, sessionMiddleware } = require('./authRoutes');
const PM = require('./permissions');
const { createInternalRouter } = require('./internalRoutes');

function missingSettings(env) {
  const out = [];
  if (!env.MONGODB_URI) out.push('MONGODB_URI');
  if (!env.MART_SESSION_SECRET || env.MART_SESSION_SECRET.length < 32) out.push('MART_SESSION_SECRET');
  return out;
}

function createApp({ express, mongoose, env = process.env }) {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '2mb' }));
  const missing = missingSettings(env);
  app.get('/api/health', (req, res) => res.json({ ok: missing.length === 0 }));
  if (missing.length) { app.use('/api', (req, res) => res.status(503).json({ success: false, message: 'Mart is not set up yet.' })); return app; }

  const billing = makeBilling({ plans: billingPlans(), ...BILLING });
  const M = makeModels(mongoose);
  const secret = env.MART_SESSION_SECRET;
  app.use('/api/mart/auth', createAuthRouter({ express, mongoose, billing, secret, termsVersion: env.MART_TERMS_VERSION }));
  // Server-to-server counts for the all-products Super Admin. Off (401) unless INTERNAL_API_KEY (24+ characters) is set in the server settings.
  app.use('/api/internal', createInternalRouter({ express, mongoose, billing, key: env.INTERNAL_API_KEY, dailyBudgetInr: Number(env.MART_DAILY_AI_BUDGET_INR) || 300 }));
  const protect = sessionMiddleware(secret, M);
  const authorize = (...roles) => (req, res, next) => (roles.includes(req.user && req.user.role) ? next() : res.status(403).json({ success: false, message: 'Not allowed.' }));
  const tenantOf = (req) => req.user.tenantId;
  const guardWrite = (req) => billing.guardWrite(req.subscription, req.method);
  const roles = PM.ROLES; // admin, subadmin, cashier, stockkeeper: what each may do is decided by permissions.js (server side)
  const noop = (req, res, next) => next();
  // Shared shop features (bills, items, stock, returns, CSV import, loyalty): same sign-in, same read-only rule for expired accounts,
  // and the pay-later limit is checked before a bill is saved.
  app.use('/api/mart/pos', protect, authorize(...roles), (req, res, next) => { const g = guardWrite(req); return g.ok ? next() : res.status(g.httpStatus || 402).json({ success: false, message: g.message, code: 'read_only' }); },
    PM.gate(PM.posPermFor), creditGuard({ mongoose, tenantOf }), createPosRouter({ express, mongoose, protect: noop, authorize: () => noop, tenantOf, roles, prefix: 'MART', ...discountHooks({ mongoose }) }));
  app.use('/api/mart', createMartRouter({ express, mongoose, protect, authorize, tenantOf, guardWrite, roles }));
  return app;
}
module.exports = { createApp, missingSettings };
