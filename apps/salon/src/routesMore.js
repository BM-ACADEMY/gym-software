'use strict';
// Salon Phase 2 routes (mounted on the same /api/salon as routes.js). Every query filters by tenantId; the tenant guard
// throws if one does not. Nothing here sends a message (suggest only). Written, not yet tested by a person.
const makeModels = require('./models');
const B = require('./booking');
const A = require('./accounts');
const PN = require('./panel');
const PV = require('./privacy');
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

  // ---- (2) data export and delete on request (owner only, audited, nothing about the request goes in the audit but the id) ----
  router.get('/privacy/customers/:id/export', adminOnly, wrap(async (req, res, tid) => {
    const c = isId(req.params.id) ? await M.Customer.findOne({ _id: req.params.id, tenantId: tid }).lean() : null; if (!c) return fail(res, 404, 'Customer not found');
    const [appointments, bills] = await Promise.all([M.Appointment.find({ tenantId: tid, customerId: c._id }).limit(2000).lean(), M.Bill.find({ tenantId: tid, customerId: c._id }).limit(2000).lean()]);
    await audit(tid, req, 'privacy.export', String(c._id));
    res.set('Cache-Control', 'no-store'); res.set('Content-Disposition', 'attachment; filename="customer-data.json"'); res.json({ success: true, data: PV.customerExport({ customer: c, appointments, bills }) });
  }));
  router.post('/privacy/customers/:id/delete', adminOnly, wrap(async (req, res, tid) => {
    if (!PV.confirmed(req.body)) throw field('To delete, send confirm: "' + PV.CONFIRM_WORD + '". This cannot be undone.');
    const c = isId(req.params.id) ? await M.Customer.findOne({ _id: req.params.id, tenantId: tid }) : null; if (!c) return fail(res, 404, 'Customer not found');
    if (c.anonymisedAt) return fail(res, 409, 'This customer was already deleted.');
    await M.Appointment.updateMany({ tenantId: tid, customerId: c._id, active: true }, { $set: { status: 'cancelled', active: false } }); // frees any held slot
    await M.Customer.updateOne({ _id: c._id, tenantId: tid }, { $set: PV.anonymisePatch(c._id) });
    await audit(tid, req, 'privacy.delete', String(c._id)); res.json({ success: true, message: 'The customer details were removed. Bills stay for your accounts, without the name or phone.' });
  }));
  router.get('/privacy/export.json', adminOnly, wrap(async (req, res, tid) => {
    const [tenant, services, staff, customers, bills, expenses] = await Promise.all([M.Tenant.findById(tid).lean(), M.Service.find({ tenantId: tid }).limit(500).lean(), M.Staff.find({ tenantId: tid }).limit(500).lean(), M.Customer.find({ tenantId: tid }).limit(5000).lean(), M.Bill.find({ tenantId: tid }).limit(5000).lean(), M.Expense.find({ tenantId: tid }).limit(5000).lean()]);
    await audit(tid, req, 'privacy.export.business', String(tid));
    const strip = (o) => { const { _id, tenantId, __v, ...rest } = o; return rest; };
    res.set('Cache-Control', 'no-store'); res.set('Content-Disposition', 'attachment; filename="business-data.json"');
    res.json({ success: true, data: { schema: 1, currency: 'INR', business: { businessName: tenant.businessName, preset: tenant.preset, address: tenant.address, gstin: tenant.gstin }, services: services.map(strip), staff: staff.map(strip), customers: customers.map(strip), bills: bills.map(strip), expenses: expenses.map(strip), note: 'Up to 5,000 rows of each kind. Ask for more in parts if you have more.' } });
  }));

  return router;
}
module.exports = { createSalonMoreRouter };
