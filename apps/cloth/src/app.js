'use strict';
// Builds the Cloth server. FAILS CLOSED: if a required setting is missing, every /api route answers 503 and nothing else runs.
// Required settings (server settings file only, never git): MONGODB_URI, CLOTH_SESSION_SECRET (32+ characters).
// Written, not yet tested by a person.
const { makeBilling } = require('../../../packages/core-billing/src');
const corePos = require('../../../packages/core-pos/src');
const { billingPlans, BILLING } = require('./plans');
const makeModels = require('./models');
const { createClothRouter } = require('./routes');
const createBillGuard = require('./billGuard');
const { createAuthRouter, sessionMiddleware } = require('./authRoutes');
const { runUnscoped } = require('../../../packages/core-server/src');

const missingSettings = (env) => { const out = []; if (!env.MONGODB_URI) out.push('MONGODB_URI'); if (!env.CLOTH_SESSION_SECRET || env.CLOTH_SESSION_SECRET.length < 32) out.push('CLOTH_SESSION_SECRET'); return out; };

function createApp({ express, mongoose, env = process.env }) {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '1mb' }));
  const missing = missingSettings(env);
  app.get('/api/health', (req, res) => res.json({ ok: missing.length === 0 }));
  if (missing.length) { app.use('/api', (req, res) => res.status(503).json({ success: false, message: 'Cloth is not set up yet.' })); return app; }

  const billing = makeBilling({ plans: billingPlans(), ...BILLING });
  const M = makeModels(mongoose); const pos = corePos.models(mongoose); M.PosCustomer = pos.PosCustomer; M.PosItem = pos.PosItem;
  const secret = env.CLOTH_SESSION_SECRET;
  app.use('/api/cloth/auth', createAuthRouter({ express, mongoose, billing, secret, termsVersion: env.CLOTH_TERMS_VERSION }));
  const protect = sessionMiddleware(secret, M);
  const authorize = (...roles) => (req, res, next) => (roles.includes(req.user && req.user.role) ? next() : res.status(403).json({ success: false, message: 'Not allowed.' }));
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
    return rows.map((b) => ({ id: String(b._id), number: b.number, date: new Date(b.createdAt.getTime() + 5.5 * 3600000).toISOString().slice(0, 10), total: b.total, discount: b.discount || 0, status: b.status, by: b.by && String(b.by), customerId: b.customerId && String(b.customerId), taxable: b.taxable, gst: b.gst, lines: b.lines || [] }));
  };
  app.use('/api/cloth', createClothRouter({ ...common, M, billsBetween, planOf: (req) => billing.computeStatus(req.subscription).planKey, guardWrite: (req) => { const g = billing.guardWrite(req.subscription, req.method); return g.ok ? null : { status: g.httpStatus, message: g.message }; }, salesOfDay }));
  app.use('/api/pos', protect, authorize('admin', 'subadmin'), createBillGuard({ M }), corePos.createPosRouter({ ...common, mongoose, prefix: 'CL' }));
  return app;
}
module.exports = { createApp, missingSettings };
