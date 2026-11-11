'use strict';
// Builds the Wash server. FAILS CLOSED: if a required setting is missing, every /api route answers 503 and nothing else runs.
// Required settings (server settings file only, never git): MONGODB_URI, WASH_SESSION_SECRET (32+ characters).
// No AI call is made anywhere in this slice. Written, not yet tested by a person.
const { makeBilling } = require('../../../packages/core-billing/src');
const createPosRouter = require('../../../packages/core-pos/src/routes');
const { billingPlans, BILLING } = require('./plans');
const makeModels = require('./models');
const { createWashRouter } = require('./routes');
const { createPublicBookingRouter } = require('./publicBooking');
const { createAuthRouter, sessionMiddleware } = require('./authRoutes');

function missingSettings(env) {
  const out = [];
  if (!env.MONGODB_URI) out.push('MONGODB_URI');
  if (!env.WASH_SESSION_SECRET || env.WASH_SESSION_SECRET.length < 32) out.push('WASH_SESSION_SECRET');
  return out;
}

function createApp({ express, mongoose, env = process.env }) {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '1mb' }));
  const missing = missingSettings(env);
  app.get('/api/health', (req, res) => res.json({ ok: missing.length === 0 }));
  if (missing.length) { app.use('/api', (req, res) => res.status(503).json({ success: false, message: 'Wash is not set up yet.' })); return app; }

  const billing = makeBilling({ plans: billingPlans(), ...BILLING });
  const M = makeModels(mongoose);
  const secret = env.WASH_SESSION_SECRET;
  app.use('/api/wash/auth', createAuthRouter({ express, mongoose, billing, secret, termsVersion: env.WASH_TERMS_VERSION }));
  // Public booking link (no sign-in; the secret token is the key). Closed when the plan has ended.
  app.use('/api/wash-book', createPublicBookingRouter({ express, mongoose, isOpen: (t) => ['trial', 'active', 'grace'].includes(billing.computeStatus(t).status) }));
  const protect = sessionMiddleware(secret, M);
  const authorize = (...roles) => (req, res, next) => (roles.includes(req.user && req.user.role) ? next() : res.status(403).json({ success: false, message: 'Not allowed.' }));
  const planOf = (req) => billing.computeStatus(req.subscription).planKey;
  const guardWrite = (req) => billing.guardWrite(req.subscription, req.method);
  app.use('/api/wash', createWashRouter({ express, mongoose, protect, authorize, tenantOf: (req) => req.user.tenantId, planOf, guardWrite }));
  // Shared shop features (customers, bills with GST, loyalty, CSV import) from the core package, same sign-in and same read-only guard.
  const posGuard = (req, res, next) => { const g = guardWrite(req); return g.ok ? next() : res.status(g.httpStatus || 402).json({ success: false, message: g.message, code: 'read_only' }); };
  app.use('/api/pos', protect, posGuard, createPosRouter({ express, mongoose, protect: (req, res, next) => next(), authorize, tenantOf: (req) => req.user.tenantId, prefix: 'WSH' }));
  return app;
}
module.exports = { createApp, missingSettings };
