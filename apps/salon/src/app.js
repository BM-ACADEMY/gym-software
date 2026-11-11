'use strict';
// Builds the Salon (Groom) server. FAILS CLOSED: if a required setting is missing, every /api route answers 503 and nothing else runs.
// Required settings (server settings file only, never git): MONGODB_URI, SALON_SESSION_SECRET (32+ characters).
const { makeBilling } = require('../../../packages/core-billing/src');
const { billingPlans, BILLING } = require('./plans');
const makeModels = require('./models');
const { createSalonRouter, createPublicRouter } = require('./routes');
const { createSalonMoreRouter } = require('./routesMore');
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
  app.use(express.json({ limit: '200kb' }));
  const missing = missingSettings(env);
  app.get('/api/health', (req, res) => res.json({ ok: missing.length === 0 }));
  if (missing.length) { app.use('/api', (req, res) => res.status(503).json({ success: false, message: 'Groom is not set up yet.' })); return app; }

  const billing = makeBilling({ plans: billingPlans(), ...BILLING });
  const M = makeModels(mongoose); const secret = env.SALON_SESSION_SECRET;
  app.use('/api/salon/auth', createAuthRouter({ express, mongoose, billing, secret, termsVersion: env.SALON_TERMS_VERSION }));
  // Public booking link: the secret token is the key; consent tick required; rate limited.
  app.use('/api/salon-book', createPublicRouter({ express, mongoose }));
  const protect = sessionMiddleware(secret, M);
  const authorize = (...roles) => (req, res, next) => (roles.includes(req.user && req.user.role) ? next() : res.status(403).json({ success: false, message: 'Not allowed.' }));
  app.use('/api/salon', createSalonRouter({ express, mongoose, protect, authorize, tenantOf: (req) => req.user.tenantId, guardWrite: (req) => billing.guardWrite(req.subscription, req.method) }));
  app.use('/api/salon', createSalonMoreRouter({ express, mongoose, protect, authorize, tenantOf: (req) => req.user.tenantId, guardWrite: (req) => billing.guardWrite(req.subscription, req.method), env }));
  return app;
}
module.exports = { createApp, missingSettings };
