'use strict';
// Builds the Salon (Groom) server. FAILS CLOSED: if a required setting is missing, every /api route answers 503 and nothing else runs.
// Required settings (server settings file only, never git): MONGODB_URI, SALON_SESSION_SECRET (32+ characters).
const { makeBilling } = require('../../../packages/core-billing/src');
const { mountBilling, rawBodyCapture } = require('../../../packages/core-billing/src/checkout');
const { billingPlans, BILLING } = require('./plans');
const makeModels = require('./models');
const { createSalonRouter, createPublicRouter } = require('./routes');
const { createSalonMoreRouter } = require('./routesMore');
const { createSalonFinalRouter } = require('./routesFinal');
const { createInternalRouter } = require('./internalRoutes');
const { firstWin: FW } = require('../../../packages/core-pos/src');
const { makeConfig: firstWinConfig } = require('./firstWin');
const { createAuthRouter, sessionMiddleware } = require('./authRoutes');

function missingSettings(env) {
  const out = [];
  if (!env.MONGODB_URI) out.push('MONGODB_URI');
  if (!env.SALON_SESSION_SECRET || env.SALON_SESSION_SECRET.length < 32) out.push('SALON_SESSION_SECRET');
  return out;
}

function createApp({ express, mongoose, env = process.env }) {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '200kb', verify: rawBodyCapture }));
  const missing = missingSettings(env);
  app.get('/api/health', (req, res) => res.json({ ok: missing.length === 0 }));
  if (missing.length) { app.use('/api', (req, res) => res.status(503).json({ success: false, message: 'Groom is not set up yet.' })); return app; }

  const billing = makeBilling({ plans: billingPlans(), ...BILLING });
  const M = makeModels(mongoose); const secret = env.SALON_SESSION_SECRET;
  app.use('/api/salon/auth', createAuthRouter({ express, mongoose, billing, secret, termsVersion: env.SALON_TERMS_VERSION }));
  // Public booking link: the secret token is the key; consent tick required; rate limited.
  app.use('/api/salon-book', createPublicRouter({ express, mongoose }));
  app.use('/api/internal', createInternalRouter({ express, mongoose, billing, key: env.INTERNAL_API_KEY }));
  const protect = sessionMiddleware(secret, M);
  const authorize = (...roles) => (req, res, next) => (roles.includes(req.user && req.user.role) ? next() : res.status(403).json({ success: false, message: 'Not allowed.' }));
  mountBilling({ app, express, mongoose, M, protect, authorize, billing, config: { plans: billingPlans(), ...BILLING }, env, product: { key: 'salon', name: 'Groom', invoicePrefix: 'SALON' }, nameOf: (t) => t.businessName }); // sign-up to payment to renewal
  app.use('/api/salon', createSalonRouter({ express, mongoose, protect, authorize, tenantOf: (req) => req.user.tenantId, guardWrite: (req) => billing.guardWrite(req.subscription, req.method) }));
  app.use('/api/salon', createSalonMoreRouter({ express, mongoose, protect, authorize, tenantOf: (req) => req.user.tenantId, guardWrite: (req) => billing.guardWrite(req.subscription, req.method), env }));
  app.use('/api/salon', createSalonFinalRouter({ express, mongoose, protect, authorize, tenantOf: (req) => req.user.tenantId, guardWrite: (req) => billing.guardWrite(req.subscription, req.method), env }));
  // First win in five minutes + set-up checklist (owner only, tenant scoped).
  app.use('/api/salon', FW.createFirstWinRouter({ express, mongoose, protect, tenantOf: (req) => req.user.tenantId, guardWrite: (req) => billing.guardWrite(req.subscription, req.method), config: firstWinConfig(M) }));
  return app;
}
module.exports = { createApp, missingSettings };
