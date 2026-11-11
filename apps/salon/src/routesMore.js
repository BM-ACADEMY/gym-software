'use strict';
// Salon Phase 2 routes (mounted on the same /api/salon as routes.js). Every query filters by tenantId; the tenant guard
// throws if one does not. Nothing here sends a message (suggest only). Written, not yet tested by a person.
const makeModels = require('./models');
const B = require('./booking');
const A = require('./accounts');
const PN = require('./panel');
const { makeFail, makeWrap, field, str, plain, isId } = require('./routes');

function createSalonMoreRouter({ express, mongoose, protect, authorize, tenantOf, guardWrite, env = process.env, roles = ['admin', 'staff', 'doctor'] }) {
  const router = express.Router(); const M = makeModels(mongoose);
  router.use(protect, authorize(...roles));
  if (guardWrite) router.use((req, res, next) => { const g = guardWrite(req); return g.ok ? next() : res.status(g.httpStatus || 402).json({ success: false, message: g.message, code: 'read_only' }); });
  const fail = makeFail(); const wrap = makeWrap(fail, tenantOf);
  const adminOnly = (req, res, next) => (req.user && req.user.role === 'admin' ? next() : fail(res, 403, 'Only the owner can do this.'));
  const today = () => B.istParts().date;
  const audit = (tid, req, action, ref) => M.Audit.create({ tenantId: tid, by: req.user.id, action, ref }).catch(() => {});

  // ---- (1) owner-panel accounts screens: month view with no dates to type ----
  router.get('/accounts/month', adminOnly, wrap(async (req, res, tid) => {
    const month = str(req.query.month, 7) || today().slice(0, 7); const r = PN.monthRange(month); if (!r) throw field('Pick a month like 2026-11.');
    const [bills, exp, unpaid] = await Promise.all([M.Bill.find({ tenantId: tid, date: { $gte: r.from, $lte: r.to } }).lean(), M.Expense.find({ tenantId: tid, date: { $gte: r.from, $lte: r.to } }).lean(), M.Expense.find({ tenantId: tid, paid: false }).limit(500).lean()]);
    res.set('Cache-Control', 'no-store'); res.json({ success: true, data: PN.accountsMonth({ month, bills, expenses: exp, supplierDues: A.supplierDues(unpaid) }) });
  }));
  router.get('/discounts/staff', adminOnly, wrap(async (req, res, tid) => {
    const bills = await M.Bill.find({ tenantId: tid, date: { $gte: B.addDays(today(), -60) } }).sort({ date: -1 }).limit(1000).lean();
    res.json({ success: true, data: PN.staffDiscountRows(bills) });
  }));

  // ---- (2) audit trail screen (owner only; never customer details) ----
  router.get('/audit', adminOnly, wrap(async (req, res, tid) => {
    const rows = await M.Audit.find({ tenantId: tid }).sort({ createdAt: -1 }).limit(200).lean();
    res.json({ success: true, data: rows.map((r) => ({ id: String(r._id), at: r.createdAt, by: r.by, action: r.action, ref: r.ref })) });
  }));

  return router;
}
module.exports = { createSalonMoreRouter };
