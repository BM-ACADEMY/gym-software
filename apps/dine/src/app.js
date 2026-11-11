'use strict';
// Builds the Dine server. FAILS CLOSED: if a required setting is missing, every /api route answers 503 and nothing else runs.
// Required settings (server settings file only, never git): MONGODB_URI, DINE_SESSION_SECRET (32+ characters).
const { makeBilling } = require('../../../packages/core-billing/src');
const { billingPlans, BILLING } = require('./plans');
const makeModels = require('./models');
const { createDineRouter } = require('./routes');
const { createAuthRouter, sessionMiddleware } = require('./authRoutes');
const { createPublicRouter } = require('./publicRoutes');
const { createInternalRouter } = require('./internalRoutes');

function missingSettings(env) {
  const out = [];
  if (!env.MONGODB_URI) out.push('MONGODB_URI');
  if (!env.DINE_SESSION_SECRET || env.DINE_SESSION_SECRET.length < 32) out.push('DINE_SESSION_SECRET');
  return out;
}

function createApp({ express, mongoose, env = process.env }) {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '200kb' }));
  const missing = missingSettings(env);
  app.get('/api/health', (req, res) => res.json({ ok: missing.length === 0 }));
  if (missing.length) { app.use('/api', (req, res) => res.status(503).json({ success: false, message: 'Dine is not set up yet.' })); return app; }

  const billing = makeBilling({ plans: billingPlans(), ...BILLING });
  const M = makeModels(mongoose);
  const secret = env.DINE_SESSION_SECRET;
  app.use('/api/dine/auth', createAuthRouter({ express, mongoose, billing, secret, termsVersion: env.DINE_TERMS_VERSION }));
  app.use('/api/internal', createInternalRouter({ express, mongoose, billing, key: env.INTERNAL_API_KEY }));
  app.use('/dine-public', createPublicRouter({ express, models: M }));
  const protect = sessionMiddleware(secret, M);
  app.use('/api/dine', createDineRouter({
    express, mongoose, models: M, protect,
    tenantOf: (req) => req.user.tenantId,
    planOf: (req) => billing.computeStatus(req.subscription).planKey,
    guardWrite: (req) => billing.guardWrite(req.subscription, req.method),
  }));
  return app;
}
module.exports = { createApp, missingSettings };
