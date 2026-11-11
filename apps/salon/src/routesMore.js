'use strict';
// Salon Phase 2 routes (mounted on the same /api/salon as routes.js). Every query filters by tenantId; the tenant guard
// throws if one does not. Nothing here sends a message (suggest only). Written, not yet tested by a person.
const makeModels = require('./models');
const B = require('./booking');
const A = require('./accounts');
const PN = require('./panel');
const PV = require('./privacy');
const CI = require('./customerImport');
const PK = require('./packages');
const LR = require('./loyaltyRule');
const LOY = require('../../../packages/core-pos/src/loyalty');
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

  // ---- (3) customer CSV import: preview first, then commit. Imported customers have no consent unless the owner confirms they agreed. ----
  router.post('/customers/import', adminOnly, wrap(async (req, res, tid) => {
    const b = req.body || {}; const text = typeof b.csv === 'string' ? b.csv : ''; if (!text.trim() || text.length > 400000) throw field('Paste or send the customer file (CSV), up to about 1,000 rows.');
    const have = new Set((await M.Customer.find({ tenantId: tid }).select('phone').limit(20000).lean()).map((c) => c.phone));
    const plan = CI.planImport({ text, existingPhones: have, consentConfirmed: b.consentConfirmed === true });
    if (b.commit !== true) return res.json({ success: true, preview: true, summary: plan.summary, rows: plan.rows.slice(0, 100), errors: plan.errors.slice(0, 50), note: 'Nothing is saved yet. Send again with commit: true to save the new customers.' });
    let added = 0;
    for (const r of plan.toCreate) {
      try {
        const c = await M.Customer.create({ tenantId: tid, name: r.name, phone: r.phone, note: r.note, loyaltyBalance: r.points || 0, consent: b.consentConfirmed === true ? { at: new Date(), source: 'import-owner-confirmed' } : undefined });
        if (r.points > 0) await M.LoyaltyEntry.create({ tenantId: tid, customerId: c._id, points: r.points, reason: 'import', note: 'from the old file' });
        added += 1;
      } catch (e) { if (e.code !== 11000) throw e; }
    }
    await audit(tid, req, 'customers.import', String(added) + ' added'); res.status(201).json({ success: true, added, skippedDuplicates: plan.summary.duplicates, invalid: plan.summary.invalid, message: `Added ${added} customers.` });
  }));

  // ---- loyalty (core-pos rules): ledger is the truth; the balance guard stops two taps spending the same points ----
  router.get('/customers/:id/loyalty', wrap(async (req, res, tid) => {
    const c = isId(req.params.id) ? await M.Customer.findOne({ _id: req.params.id, tenantId: tid }).lean() : null; if (!c) return fail(res, 404, 'Customer not found');
    const ledger = await M.LoyaltyEntry.find({ tenantId: tid, customerId: c._id }).sort({ createdAt: -1 }).limit(500).lean(); const rule = LR.normalize((await M.Tenant.findById(tid).lean()).loyaltyRule);
    res.json({ success: true, data: { enabled: rule.enabled, balance: LOY.balanceOf(ledger), rule, recent: ledger.slice(0, 20).map((l) => ({ at: l.createdAt, points: l.points, reason: l.reason })) } });
  }));
  router.post('/customers/:id/loyalty/redeem', wrap(async (req, res, tid) => {
    const t = await M.Tenant.findById(tid).lean(); const rule = LR.normalize(t.loyaltyRule); if (!rule.enabled) throw field('Loyalty points are not turned on.');
    const c = isId(req.params.id) ? await M.Customer.findOne({ _id: req.params.id, tenantId: tid }).lean() : null; if (!c) return fail(res, 404, 'Customer not found');
    const billTotal = Math.round(Number((req.body || {}).billTotal)); if (!Number.isInteger(billTotal) || billTotal < 1) throw field('Enter the bill total in whole rupees.');
    let r; try { r = LOY.redeem({ requestedPoints: (req.body || {}).points, balance: Math.max(0, Math.round(c.loyaltyBalance || 0)), billTotal }, rule); } catch (e) { if (e.code === 'LOYALTY_INVALID') throw field(e.message); throw e; }
    if (!r.points) throw field('Enter how many points to use.');
    const g = await M.Customer.findOneAndUpdate({ _id: c._id, tenantId: tid, loyaltyBalance: { $gte: r.points } }, { $inc: { loyaltyBalance: -r.points } }, { new: true }); if (!g) return fail(res, 409, 'Not enough points any more.');
    await M.LoyaltyEntry.create({ tenantId: tid, customerId: c._id, points: -r.points, reason: 'redeem', note: 'used at billing' });
    await audit(tid, req, 'loyalty.redeem', String(c._id) + ' ' + r.points);
    res.json({ success: true, data: { points: r.points, rupees: r.rupees, currency: 'INR', next: 'Give this as a discount on the bill with the reason "loyalty points". The discount rule still applies.' } });
  }));

  // ---- packages and memberships ("session 4 of 10") ----
  router.post('/packages', adminOnly, wrap(async (req, res, tid) => {
    const b = req.body || {}; const c = isId(b.customerId) ? await M.Customer.findOne({ _id: b.customerId, tenantId: tid }).lean() : null; if (!c) return fail(res, 404, 'Customer not found');
    const v = PK.validate(b, B.validDate); if (v.error) throw field(v.error);
    const d = await M.Package.create({ tenantId: tid, customerId: c._id, serviceKey: str(b.serviceKey, 40) || undefined, ...v.value });
    await audit(tid, req, 'package.sell', String(d._id)); res.status(201).json({ success: true, data: PK.describe({ ...plain(d) }, today()), note: 'Put the package price on a bill as an item so it shows in your accounts.' });
  }));
  router.get('/packages', wrap(async (req, res, tid) => {
    const q = { tenantId: tid }; if (isId(req.query.customerId)) q.customerId = req.query.customerId;
    const rows = await M.Package.find(q).sort({ createdAt: -1 }).limit(200).lean(); res.json({ success: true, data: rows.map((p) => PK.describe({ ...p, id: String(p._id) }, today())) });
  }));
  router.post('/packages/:id/use', wrap(async (req, res, tid) => {
    const p = isId(req.params.id) ? await M.Package.findOne({ _id: req.params.id, tenantId: tid }).lean() : null; if (!p) return fail(res, 404, 'Package not found');
    if (PK.expired(p, today())) return fail(res, 409, 'This package has expired.');
    const g = await M.Package.findOneAndUpdate({ _id: p._id, tenantId: tid, active: true, left: { $gt: 0 } }, { $inc: { left: -1 } }, { new: true }); if (!g) return fail(res, 409, 'No sessions left in this package.');
    await M.PackageUse.create({ tenantId: tid, packageId: p._id, by: req.user.id, appointmentId: isId((req.body || {}).appointmentId) ? req.body.appointmentId : undefined });
    res.json({ success: true, data: PK.describe({ ...g.toObject ? g.toObject() : g, id: String(g._id) }, today()) });
  }));

  return router;
}
module.exports = { createSalonMoreRouter };
