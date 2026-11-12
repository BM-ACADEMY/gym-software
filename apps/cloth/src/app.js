'use strict';
// Builds the Cloth server. FAILS CLOSED: if a required setting is missing, every /api route answers 503 and nothing else runs.
// Required settings (server settings file only, never git): MONGODB_URI, CLOTH_SESSION_SECRET (32+ characters).
// Written, not yet tested by a person.
const { makeBilling } = require('../../../packages/core-billing/src');
const { mountBilling, rawBodyCapture } = require('../../../packages/core-billing/src/checkout');
const corePos = require('../../../packages/core-pos/src');
const { makeConfig: firstWinConfig } = require('./firstWin');
const { billingPlans, BILLING } = require('./plans');
const makeModels = require('./models');
const { createClothRouter } = require('./routes');
const createBillGuard = require('./billGuard'); const { discountHooks } = createBillGuard;
const { createAuthRouter, sessionMiddleware } = require('./authRoutes');
const { createPickupRouter } = require('./pickupRoutes'); const { createCatalogueRouter } = require('./catalogueRoutes');
const { createInternalRouter } = require('./internalRoutes');
const { runUnscoped } = require('../../../packages/core-server/src');

const missingSettings = (env) => { const out = []; if (!env.MONGODB_URI) out.push('MONGODB_URI'); if (!env.CLOTH_SESSION_SECRET || env.CLOTH_SESSION_SECRET.length < 32) out.push('CLOTH_SESSION_SECRET'); return out; };

function createApp({ express, mongoose, env = process.env }) {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '1mb', verify: rawBodyCapture }));
  const missing = missingSettings(env);
  app.get('/api/health', (req, res) => res.json({ ok: missing.length === 0 }));
  if (missing.length) { app.use('/api', (req, res) => res.status(503).json({ success: false, message: 'Cloth is not set up yet.' })); return app; }

  const billing = makeBilling({ plans: billingPlans(), ...BILLING });
  const M = makeModels(mongoose); const pos = corePos.models(mongoose); M.PosCustomer = pos.PosCustomer; M.PosItem = pos.PosItem;
  const secret = env.CLOTH_SESSION_SECRET;
  app.use('/api/cloth/auth', createAuthRouter({ express, mongoose, billing, secret, termsVersion: env.CLOTH_TERMS_VERSION }));
  app.use('/api/internal', createInternalRouter({ express, mongoose, billing, key: env.INTERNAL_API_KEY, dailyBudgetInr: 0 })); // Super Admin only, counts only, off without INTERNAL_API_KEY
  app.use('/api/cloth-pickup', createPickupRouter({ express, M })); // public: the secret token is the key
  app.use('/api/cloth-catalogue', createCatalogueRouter({ express, M })); // public: only items the owner marked public, token is the key
  const protect = sessionMiddleware(secret, M);
  const authorize = (...roles) => (req, res, next) => (roles.includes(req.user && req.user.role) ? next() : res.status(403).json({ success: false, message: 'Not allowed.' }));
  mountBilling({ app, express, mongoose, M, protect, authorize, billing, config: { plans: billingPlans(), ...BILLING }, env, product: { key: 'cloth', name: 'Cloth', invoicePrefix: 'CLOTH' }, nameOf: (t) => t.shopName }); // sign-up to payment to renewal
  const common = { express, protect, authorize, tenantOf: (req) => req.user.tenantId };
  // Yesterday's takings for the daily summary, from the shared bill records (this shop only).
  const salesOfDay = async (tid, date) => {
    const from = new Date(Date.parse(date + 'T00:00:00Z') - 5.5 * 3600000); const to = new Date(from.getTime() + 86400000);
    const rows = await runUnscoped('daily summary: one shop\'s bills for one day, filtered by tenantId', () => pos.PosBill.aggregate([{ $match: { tenantId: new mongoose.Types.ObjectId(String(tid)), createdAt: { $gte: from, $lt: to }, status: { $ne: 'returned' } } }, { $group: { _id: null, total: { $sum: '$total' }, bills: { $sum: 1 } } }]));
    return { total: (rows[0] && rows[0].total) || 0, bills: (rows[0] && rows[0].bills) || 0 };
  };
  // One shop's bills between two IST dates, shaped for reports (this shop only: tenantId is in the filter).
  const billsBetween = async (tid, fromDate, toDate) => {
    const from = new Date(Date.parse(fromDate + 'T00:00:00Z') - 5.5 * 3600000); const to = new Date(Date.parse(toDate + 'T00:00:00Z') + 86400000 - 5.5 * 3600000);
    const rows = await pos.PosBill.find({ tenantId: new mongoose.Types.ObjectId(String(tid)), createdAt: { $gte: from, $lt: to } }).limit(20000).lean();
    return rows.map((b) => ({ id: String(b._id), number: b.number, date: new Date(b.createdAt.getTime() + 5.5 * 3600000).toISOString().slice(0, 10), at: b.createdAt.toISOString(), total: b.total, discount: b.discount || 0, status: b.status, by: b.by && String(b.by), customerId: b.customerId && String(b.customerId), taxable: b.taxable, gst: b.gst, lines: b.lines || [] }));
  };
  // First win in five minutes + set-up checklist (owner only, tenant scoped).
  app.use('/api/cloth', corePos.firstWin.createFirstWinRouter({ express, mongoose, protect, tenantOf: (req) => req.user.tenantId, guardWrite: (req) => billing.guardWrite(req.subscription, req.method), config: firstWinConfig(M, pos) }));
  app.use('/api/cloth', createClothRouter({ ...common, M, billsBetween, planOf: (req) => billing.computeStatus(req.subscription).planKey, guardWrite: (req) => { const g = billing.guardWrite(req.subscription, req.method); return g.ok ? null : { status: g.httpStatus, message: g.message }; }, salesOfDay }));
  app.use('/api/pos', protect, authorize('admin', 'subadmin'), createBillGuard({ M }), corePos.createPosRouter({ ...common, mongoose, prefix: 'CL', ...discountHooks({ M }) }));
  return app;
}
module.exports = { createApp, missingSettings };
