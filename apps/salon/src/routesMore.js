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
const SP = require('./staffPay');
const RT = require('./returns');
const ST = require('./stock');
const SO = require('./stockOps');
const BP = require('./bookingPage');
const LOY2 = require('../../../packages/core-pos/src/loyalty');
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
    const [bills, exp, unpaid, refunds] = await Promise.all([M.Bill.find({ tenantId: tid, date: { $gte: r.from, $lte: r.to } }).lean(), M.Expense.find({ tenantId: tid, date: { $gte: r.from, $lte: r.to } }).lean(), M.Expense.find({ tenantId: tid, paid: false }).limit(500).lean(), M.Return.find({ tenantId: tid, date: { $gte: r.from, $lte: r.to } }).limit(5000).lean()]);
    res.set('Cache-Control', 'no-store'); res.json({ success: true, data: PN.accountsMonth({ month, bills, expenses: exp, supplierDues: A.supplierDues(unpaid), refunds }) });
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

  // ---- (4) staff: attendance, leave, shifts, advances, payslip. The owner marks and approves; a staff login sees only their own. ----
  const ownStaffOnly = (req, staffId) => req.user.role === 'admin' || (req.user.staffId && String(req.user.staffId) === String(staffId));
  const staffOk = async (tid, id) => (isId(id) ? M.Staff.findOne({ _id: id, tenantId: tid }).lean() : null);
  router.put('/staff/:id/salary', adminOnly, wrap(async (req, res, tid) => {
    const v = Math.round(Number((req.body || {}).baseSalary)); if (!Number.isInteger(v) || v < 0 || v > 10000000) throw field('Salary must be whole rupees a month.');
    const d = isId(req.params.id) ? await M.Staff.findOneAndUpdate({ _id: req.params.id, tenantId: tid }, { $set: { baseSalary: v } }, { new: true }) : null; if (!d) return fail(res, 404, 'Not found');
    await audit(tid, req, 'staff.salary', String(d._id)); res.json({ success: true });
  }));
  router.put('/attendance', adminOnly, wrap(async (req, res, tid) => {
    const b = req.body || {}; if (!SP.STATUS.includes(b.status)) throw field('Choose present, half, absent, paid leave or unpaid leave.');
    if (!B.validDate(b.day) || b.day > today() || B.daysBetween(b.day, today()) > 62) throw field('Pick a day from today back to 62 days ago.');
    if (!(await staffOk(tid, b.staffId))) return fail(res, 404, 'Staff member not found');
    await M.Attendance.findOneAndUpdate({ tenantId: tid, staffId: b.staffId, day: b.day }, { $set: { status: b.status } }, { upsert: true, new: true });
    await audit(tid, req, 'attendance.mark', b.staffId + ' ' + b.day); res.json({ success: true });
  }));
  router.get('/attendance', wrap(async (req, res, tid) => {
    const month = str(req.query.month, 7) || today().slice(0, 7); if (!SP.validMonth(month)) throw field('Pick a month like 2026-11.');
    const q = { tenantId: tid, day: { $gte: month + '-01', $lte: month + '-31' } }; if (req.user.role !== 'admin') q.staffId = req.user.staffId || 'none';
    const rows = await M.Attendance.find(q).limit(5000).lean(); const flat = rows.map((r) => ({ staffId: String(r.staffId), day: r.day, status: r.status }));
    res.json({ success: true, data: { month, rows: flat, summary: SP.monthSummary(flat, month) } });
  }));
  router.post('/leave', wrap(async (req, res, tid) => {
    const b = req.body || {}; const staffId = req.user.role === 'admin' ? b.staffId : req.user.staffId;
    if (!(await staffOk(tid, staffId))) return fail(res, 404, 'Staff member not found');
    if (!B.validDate(b.from) || !B.validDate(b.to) || b.from > b.to || B.daysBetween(b.from, b.to) > 30) throw field('Pick from and to dates (up to 31 days).');
    const d = await M.Leave.create({ tenantId: tid, staffId, from: b.from, to: b.to, kind: SP.LEAVE_KINDS.includes(b.kind) ? b.kind : 'unpaid', note: str(b.note, 200) || undefined, status: 'requested' });
    res.status(201).json({ success: true, data: plain(d) });
  }));
  router.get('/leave', wrap(async (req, res, tid) => {
    const q = { tenantId: tid }; if (req.user.role !== 'admin') q.staffId = req.user.staffId || 'none';
    res.json({ success: true, data: (await M.Leave.find(q).sort({ createdAt: -1 }).limit(200).lean()).map((l) => ({ ...l, id: String(l._id) })) });
  }));
  router.post('/leave/:id/decide', adminOnly, wrap(async (req, res, tid) => {
    const approve = (req.body || {}).approve === true; const l = isId(req.params.id) ? await M.Leave.findOne({ _id: req.params.id, tenantId: tid, status: 'requested' }) : null; if (!l) return fail(res, 404, 'No waiting leave request found');
    const t = await M.Tenant.findById(tid).lean();
    const g = await M.Leave.findOneAndUpdate({ _id: l._id, tenantId: tid, status: 'requested' }, { $set: { status: approve ? 'approved' : 'rejected' } }, { new: true }); if (!g) return fail(res, 409, 'Already decided.');
    if (approve) for (const day of SP.leaveDays(l.from, l.to, t.closedWeekdays)) await M.Attendance.findOneAndUpdate({ tenantId: tid, staffId: l.staffId, day }, { $set: { status: l.kind === 'paid' ? 'paid_leave' : 'unpaid_leave' } }, { upsert: true, new: true });
    await audit(tid, req, approve ? 'leave.approve' : 'leave.reject', String(l._id)); res.json({ success: true });
  }));
  router.put('/shifts', adminOnly, wrap(async (req, res, tid) => {
    const b = req.body || {}; if (!(await staffOk(tid, b.staffId))) return fail(res, 404, 'Staff member not found'); const v = SP.validShifts(b.shifts); if (v.error) throw field(v.error);
    await M.Shift.deleteMany({ tenantId: tid, staffId: b.staffId }); for (const sh of v.value) await M.Shift.create({ tenantId: tid, staffId: b.staffId, ...sh });
    await audit(tid, req, 'shifts.set', String(b.staffId)); res.json({ success: true });
  }));
  router.get('/shifts', wrap(async (req, res, tid) => {
    const q = { tenantId: tid }; if (req.user.role !== 'admin') q.staffId = req.user.staffId || 'none';
    res.json({ success: true, data: (await M.Shift.find(q).limit(500).lean()).map((x) => ({ staffId: String(x.staffId), weekday: x.weekday, start: x.start, end: x.end })) });
  }));
  router.post('/advances', adminOnly, wrap(async (req, res, tid) => {
    const b = req.body || {}; const amount = Math.round(Number(b.amount)); if (!Number.isInteger(amount) || amount < 1 || amount > 10000000) throw field('Enter the advance in whole rupees.');
    if (!(await staffOk(tid, b.staffId))) return fail(res, 404, 'Staff member not found');
    const d = await M.Advance.create({ tenantId: tid, staffId: b.staffId, date: B.validDate(b.date) ? b.date : today(), amount, note: str(b.note, 120) || undefined });
    await audit(tid, req, 'advance.add', String(d._id)); res.status(201).json({ success: true, data: plain(d) });
  }));
  const slipFor = async (tid, st, month, r, t) => {
    const [att, bills, adv] = await Promise.all([M.Attendance.find({ tenantId: tid, staffId: st._id, day: { $gte: r.from, $lte: r.to } }).limit(40).lean(), M.Bill.find({ tenantId: tid, date: { $gte: r.from, $lte: r.to } }).select('commissions status').lean(), M.Advance.find({ tenantId: tid, staffId: st._id, date: { $gte: r.from, $lte: r.to } }).limit(100).lean()]);
    const commission = PN.live(bills).reduce((n, b) => n + Math.round(Number((b.commissions || {})[String(st._id)]) || 0), 0);
    return SP.payslip({ month, baseSalary: st.baseSalary, closedWeekdays: t.closedWeekdays, summary: SP.monthSummary(att.map((a) => ({ staffId: String(a.staffId), day: a.day, status: a.status })), month)[String(st._id)], commission, advances: adv.reduce((n, a) => n + a.amount, 0) });
  };
  router.get('/payslip', wrap(async (req, res, tid) => {
    const staffId = req.user.role === 'admin' ? (req.query.staffId || req.query.id) : req.user.staffId; const month = str(req.query.month, 7) || today().slice(0, 7);
    if (!ownStaffOnly(req, staffId)) return fail(res, 403, 'You can see your own payslip only.');
    const st = await staffOk(tid, staffId); if (!st) return fail(res, 404, 'Staff member not found'); const r = PN.monthRange(month); if (!r) throw field('Pick a month like 2026-11.');
    const p = await slipFor(tid, st, month, r, await M.Tenant.findById(tid).lean());
    if (p.error) throw field(p.error); res.set('Cache-Control', 'no-store'); res.json({ success: true, data: { staffName: st.name, ...p } });
  }));
  // One line per staff member for the month (owner panel list).
  router.get('/payslips/month', adminOnly, wrap(async (req, res, tid) => {
    const month = str(req.query.month, 7) || today().slice(0, 7); const r = PN.monthRange(month); if (!r) throw field('Pick a month like 2026-11.');
    const t = await M.Tenant.findById(tid).lean(); const staff = await M.Staff.find({ tenantId: tid, isActive: true }).limit(200).lean(); const out = [];
    for (const st of staff) { const p = await slipFor(tid, st, month, r, t); if (!p.error) out.push({ id: String(st._id), staffName: st.name, month, workingDays: p.workingDays, paidDays: p.paidDays, unmarkedDays: p.unmarkedDays, salaryPay: p.salaryPay, commission: p.commission, advances: p.advances, net: p.net, currency: 'INR' }); }
    res.set('Cache-Control', 'no-store'); res.json({ success: true, data: out });
  }));

  // ---- (5) voids and refunds (owner only, reason needed, audited, shown in the owner's alert list) ----
  const reverseLoyalty = async (tid, billId, customerId) => {
    if (!customerId) return;
    const earned = await M.LoyaltyEntry.find({ tenantId: tid, billId, reason: 'earn' }).lean(); const pts = earned.reduce((n, e) => n + Math.round(e.points || 0), 0); if (pts <= 0) return;
    await M.LoyaltyEntry.create({ tenantId: tid, customerId, billId, points: -pts, reason: 'reverse', note: 'bill voided' });
    await M.Customer.findOneAndUpdate({ _id: customerId, tenantId: tid }, { $inc: { loyaltyBalance: -pts } });
  };
  router.post('/bills/:id/void', adminOnly, wrap(async (req, res, tid) => {
    const bill = isId(req.params.id) ? await M.Bill.findOne({ _id: req.params.id, tenantId: tid }).lean() : null; const v = RT.checkVoid({ bill, reason: (req.body || {}).reason });
    if (v.error) return fail(res, bill ? 400 : 404, v.error);
    const g = await M.Bill.findOneAndUpdate({ _id: bill._id, tenantId: tid, status: { $ne: 'void' }, refunded: { $lte: 0 } }, { $set: { status: 'void', statusBeforeVoid: bill.status, voidReason: v.value.reason, voidedBy: req.user.id, voidedAt: new Date() } }, { new: true });
    if (!g) return fail(res, 409, 'This bill changed. Open it again.');
    await reverseLoyalty(tid, bill._id, bill.customerId); try { await SO.restoreForBill(M, tid, bill, req.user.id, today()); } catch (e) { console.error('stock restore failed:', e.message); } await audit(tid, req, 'bill.void', bill.number); res.json({ success: true, message: 'The bill is voided and no longer counts in your sales.' });
  }));
  router.post('/bills/:id/return', adminOnly, wrap(async (req, res, tid) => {
    const b = req.body || {}; const bill = isId(req.params.id) ? await M.Bill.findOne({ _id: req.params.id, tenantId: tid }).lean() : null; const v = RT.checkRefund({ bill, amount: b.amount, method: b.method, reason: b.reason });
    if (v.error) return fail(res, bill ? 400 : 404, v.error);
    // One guarded update: two refunds at once cannot together give back more than the bill.
    const g = await M.Bill.findOneAndUpdate({ _id: bill._id, tenantId: tid, status: { $ne: 'void' }, refunded: { $lte: RT.paidOf(bill) - v.value.amount } }, { $inc: { refunded: v.value.amount } }, { new: true });
    if (!g) return fail(res, 409, 'That is more than can still be refunded on this bill.');
    const seq = await M.Counter.findOneAndUpdate({ tenantId: tid, key: 'return' }, { $inc: { seq: 1 } }, { new: true, upsert: true });
    try { await M.Return.create({ tenantId: tid, number: 'R' + String(seq.seq).padStart(5, '0'), billId: bill._id, billNumber: bill.number, date: today(), by: req.user.id, ...v.value }); }
    catch (e) { await M.Bill.findOneAndUpdate({ _id: bill._id, tenantId: tid }, { $inc: { refunded: -v.value.amount } }); throw e; }
    await audit(tid, req, 'bill.refund', bill.number + ' ' + v.value.amount); res.status(201).json({ success: true, data: { amount: v.value.amount, currency: 'INR', left: RT.refundable({ total: bill.total, due: bill.due, refunded: g.refunded }) } });
  }));
  router.get('/returns', adminOnly, wrap(async (req, res, tid) => res.json({ success: true, data: (await M.Return.find({ tenantId: tid }).sort({ createdAt: -1 }).limit(200).lean()).map((r) => ({ ...r, id: String(r._id) })) })));

  // ---- (6) retail stock and product use. Staff may see products; only the owner adds, buys, counts and sets what a service uses. ----
  router.get('/products', wrap(async (req, res, tid) => res.json({ success: true, data: (await M.Product.find({ tenantId: tid }).sort({ name: 1 }).limit(500).lean()).map((p) => ({ ...p, id: String(p._id) })) })));
  router.post('/products', adminOnly, wrap(async (req, res, tid) => {
    const v = ST.validateProduct(req.body || {}); if (v.error) throw field(v.error);
    const d = await M.Product.create({ tenantId: tid, ...v.value }); if (v.value.stock > 0) await M.StockMove.create({ tenantId: tid, productId: d._id, qty: v.value.stock, reason: 'adjust', ref: 'opening stock', by: req.user.id, date: today() });
    await audit(tid, req, 'product.add', String(d._id)); res.status(201).json({ success: true, data: plain(d) });
  }));
  router.patch('/products/:id', adminOnly, wrap(async (req, res, tid) => {
    const b = req.body || {}; const set = {}; if ('name' in b) set.name = str(b.name, 80); if ('reorderLevel' in b && Number.isInteger(b.reorderLevel) && b.reorderLevel >= 0) set.reorderLevel = b.reorderLevel; if ('price' in b && Number.isInteger(b.price) && b.price >= 0) set.price = b.price;
    if ('gstRate' in b && [0, 3, 5, 12, 18, 28].includes(b.gstRate)) set.gstRate = b.gstRate; if ('forSale' in b) set.forSale = b.forSale === true; if ('isActive' in b) set.isActive = b.isActive === true; if (!Object.keys(set).length) throw field('Nothing to change.');
    const d = isId(req.params.id) ? await M.Product.findOneAndUpdate({ _id: req.params.id, tenantId: tid }, { $set: set }, { new: true }) : null; if (!d) return fail(res, 404, 'Not found'); res.json({ success: true, data: plain(d) });
  }));
  router.post('/products/:id/purchase', adminOnly, wrap(async (req, res, tid) => {
    const qty = Number((req.body || {}).qty); if (!Number.isInteger(qty) || qty < 1 || qty > 1e6) throw field('Enter how many came in, as a whole number.');
    const p = isId(req.params.id) ? await M.Product.findOneAndUpdate({ _id: req.params.id, tenantId: tid }, { $inc: { stock: qty } }, { new: true }) : null; if (!p) return fail(res, 404, 'Not found');
    await M.StockMove.create({ tenantId: tid, productId: p._id, qty, reason: 'purchase', ref: str((req.body || {}).ref, 60) || undefined, by: req.user.id, date: today() }); res.json({ success: true, data: { stock: p.stock } });
  }));
  // A stock count: the owner says what is on the shelf; the difference from the system is kept and shown in the alert list.
  router.post('/products/:id/count', adminOnly, wrap(async (req, res, tid) => {
    const counted = Number((req.body || {}).counted); if (!Number.isInteger(counted) || counted < 0 || counted > 1e6) throw field('Enter what you counted, as a whole number.');
    const p0 = isId(req.params.id) ? await M.Product.findOne({ _id: req.params.id, tenantId: tid }).lean() : null; if (!p0) return fail(res, 404, 'Not found');
    const before = Math.round(p0.stock || 0); const diff = counted - before; const p = await M.Product.findOneAndUpdate({ _id: p0._id, tenantId: tid }, { $inc: { stock: diff } }, { new: true });
    const c = ST.countDiff({ system: before, counted }); await M.StockCount.create({ tenantId: tid, productId: p0._id, productName: p0.name, date: today(), system: c.system, counted, diff: c.diff, by: req.user.id });
    if (diff) await M.StockMove.create({ tenantId: tid, productId: p0._id, qty: diff, reason: 'count', ref: 'stock count', by: req.user.id, date: today() });
    await audit(tid, req, c.flagged ? 'stock.count.difference' : 'stock.count.ok', String(p0._id)); res.json({ success: true, data: { ...c, stock: p.stock, text: c.diff === 0 ? 'Count matches.' : c.diff < 0 ? `${-c.diff} fewer than the system said.` : `${c.diff} more than the system said.` } });
  }));
  router.put('/services/:id/uses', adminOnly, wrap(async (req, res, tid) => {
    const v = ST.validateUses((req.body || {}).uses); if (v.error) throw field(v.error);
    if (v.value.length) { const have = await M.Product.find({ tenantId: tid, _id: { $in: v.value.map((u) => u.productId) } }).select('_id').lean(); if (have.length !== new Set(v.value.map((u) => u.productId)).size) throw field('A product in the list was not found.'); }
    const d = isId(req.params.id) ? await M.Service.findOneAndUpdate({ _id: req.params.id, tenantId: tid }, { $set: { uses: v.value } }, { new: true }) : null; if (!d) return fail(res, 404, 'Not found'); res.json({ success: true });
  }));
  router.get('/stock/runout', adminOnly, wrap(async (req, res, tid) => {
    const t = today(); const products = await M.Product.find({ tenantId: tid, isActive: true }).limit(500).lean(); const moves = await M.StockMove.find({ tenantId: tid, date: { $gte: B.addDays(t, -30) } }).limit(20000).lean(); const by = {};
    moves.forEach((m) => { (by[String(m.productId)] = by[String(m.productId)] || []).push(m); });
    res.json({ success: true, data: products.map((p) => ({ id: String(p._id), name: p.name, stock: Math.round(p.stock || 0), unit: p.unit, reorderLevel: p.reorderLevel, low: (p.stock || 0) <= (p.reorderLevel || 0), ...ST.runOut({ stock: p.stock, moves: by[String(p._id)] || [], today: t }) })) });
  }));

  // ---- (7) booking link for the QR poster. The owner prints the text as a QR code; no image is made here. ----
  router.get('/settings/booking-qr', adminOnly, wrap(async (req, res, tid) => {
    const t = await M.Tenant.findOne({ _id: tid }).lean(); if (!t || !t.bookingToken) return fail(res, 404, 'No booking link yet. Make one in Settings.');
    const url = BP.bookingUrl(env, t.bookingToken); if (!url) return fail(res, 409, 'The public web address is not set on the server yet (SALON_PUBLIC_URL).');
    res.json({ success: true, data: { url, qrText: url, text: 'Turn this link into a QR code and print it for the counter. Anyone with it can book, so make a new link if it spreads.' } });
  }));

  // ---- (7) Clinic notes. Fails closed until a lawyer has reviewed patient records and the server switch is turned on. Doctor and owner only. ----
  const notesOn = (req, res, next) => (String(env.CLINIC_NOTES_ENABLED) === 'true' ? next() : fail(res, 503, 'Clinic notes are switched off until the legal review is done.'));
  const docOrOwner = (req, res, next) => (req.user && ['admin', 'doctor'].includes(req.user.role) ? next() : fail(res, 403, 'Only the doctor or the owner can do this.'));
  const clinicOnly = async (tid) => { const t = await M.Tenant.findOne({ _id: tid }).lean(); return t && t.preset === 'clinic'; };
  router.post('/clinic/notes', notesOn, docOrOwner, wrap(async (req, res, tid) => {
    if (!(await clinicOnly(tid))) return fail(res, 404, 'Not found'); const b = req.body || {}; const note = str(b.note, 2000); if (!note) throw field('Write the note.');
    if (!isId(b.customerId) || !(await M.Customer.findOne({ _id: b.customerId, tenantId: tid }).lean())) return fail(res, 404, 'Patient not found.');
    const d = await M.ClinicNote.create({ tenantId: tid, customerId: b.customerId, appointmentId: isId(b.appointmentId) ? b.appointmentId : undefined, note, by: String(req.user.id), byRole: req.user.role, date: today() });
    await audit(tid, req, 'clinic.note.add', String(d._id)); res.status(201).json({ success: true, data: { id: String(d._id) } });
  }));
  router.get('/clinic/notes', notesOn, docOrOwner, wrap(async (req, res, tid) => {
    if (!(await clinicOnly(tid))) return fail(res, 404, 'Not found'); if (!isId(req.query.customerId)) throw field('Pick a patient.');
    const rows = await M.ClinicNote.find({ tenantId: tid, customerId: req.query.customerId }).sort({ date: -1 }).limit(100).lean();
    await audit(tid, req, 'clinic.note.read', String(req.query.customerId)); res.json({ success: true, data: rows.map((r) => ({ id: String(r._id), date: r.date, note: r.note, byRole: r.byRole })) });
  }));
  router.get('/clinic/consent-text', wrap(async (req, res) => res.json({ success: true, data: { text: BP.CONSENT_TEXT, status: 'Draft wording. A lawyer must review it before patients see it for medical records.' } })));

  return router;
}
module.exports = { createSalonMoreRouter };
