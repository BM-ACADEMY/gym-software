const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../../middleware/auth');
const { codeFeatureGuard } = require('../../middleware/planFeatureGuard');
const PayrollRun = require('../../models/PayrollRun');
const StaffAdvance = require('../../models/StaffAdvance');
const SubAdmin = require('../../models/SubAdmin');
const Subscriber = require('../../models/Subscriber');
const runs = require('../../services/payroll/runs');
const { streamPayslip } = require('../../utils/payslipPdf');
const { logAudit } = require('../../utils/auditLog');

// Payroll shows what every person earns: owner only, on plans that include Accounts.
router.use(protect, authorize('admin'), codeFeatureGuard('accounts'));

const handle = (fn) => async (req, res) => {
  try {
    await fn(req, res);
  } catch (e) {
    const castBad = e.name === 'CastError' || e.name === 'ValidationError';
    if (!e.status && !castBad) console.error(e);
    res.status(e.status || (castBad ? 400 : 500)).json({ success: false, message: e.status ? e.message : castBad ? 'Please check the details' : 'Server error' });
  }
};
const sid = (req) => req.user.subscriberId;
const loadRun = async (req) => PayrollRun.findOne({ _id: req.params.id, subscriberId: sid(req) });

// GET /api/admin/payroll/staff: who is on payroll and what they are paid
router.get('/staff', handle(async (req, res) => {
  const staff = await SubAdmin.find({ subscriberId: sid(req), isActive: { $ne: false } }).select('name template baseSalary ptCommissionPercent').sort({ name: 1 }).lean();
  res.json({ success: true, data: staff });
}));

// PATCH /api/admin/payroll/staff/:staffId  { baseSalary, ptCommissionPercent }
router.patch('/staff/:staffId', handle(async (req, res) => {
  const set = {};
  if (req.body.baseSalary !== undefined) {
    const v = Number(req.body.baseSalary);
    if (!Number.isInteger(v) || v < 0 || v > 10000000) return res.status(400).json({ success: false, message: 'Salary must be a whole number of rupees' });
    set.baseSalary = v;
  }
  if (req.body.ptCommissionPercent !== undefined) {
    const v = Number(req.body.ptCommissionPercent);
    if (!(v >= 0 && v <= 100)) return res.status(400).json({ success: false, message: 'Commission must be 0 to 100' });
    set.ptCommissionPercent = v;
  }
  const s = await SubAdmin.findOneAndUpdate({ _id: req.params.staffId, subscriberId: sid(req) }, { $set: set }, { new: true }).select('name baseSalary ptCommissionPercent');
  if (!s) return res.status(404).json({ success: false, message: 'Staff member not found' });
  await logAudit({ subscriberId: sid(req), actingRole: 'admin', actingUserId: req.user.id, module: 'payroll', action: `salary:${s._id}` });
  res.json({ success: true, data: s });
}));

// Advances
router.get('/advances', handle(async (req, res) => {
  const list = await StaffAdvance.find({ subscriberId: sid(req) }).populate('staffId', 'name').sort({ createdAt: -1 }).limit(200).lean();
  res.json({ success: true, data: list.map((a) => ({ ...a, owed: a.amount - a.recovered })) });
}));

router.post('/advances', handle(async (req, res) => {
  const amount = Number(req.body.amount);
  if (!Number.isInteger(amount) || amount < 1 || amount > 10000000) return res.status(400).json({ success: false, message: 'Amount must be a whole number of rupees' });
  const staff = await SubAdmin.findOne({ _id: String(req.body.staffId || ''), subscriberId: sid(req) }).select('_id');
  if (!staff) return res.status(404).json({ success: false, message: 'Staff member not found' });
  const a = await StaffAdvance.create({ subscriberId: sid(req), staffId: staff._id, amount, note: typeof req.body.note === 'string' ? req.body.note : undefined });
  await logAudit({ subscriberId: sid(req), actingRole: 'admin', actingUserId: req.user.id, module: 'payroll', action: `advance:${a._id}` });
  res.status(201).json({ success: true, data: a });
}));

// Runs
router.get('/runs', handle(async (req, res) => {
  const list = await PayrollRun.find({ subscriberId: sid(req) }).select('month status totals currency lockedAt').sort({ month: -1 }).limit(60).lean();
  res.json({ success: true, data: list });
}));

router.post('/runs', handle(async (req, res) => {
  const run = await runs.createRun({ subscriberId: sid(req), month: typeof req.body.month === 'string' ? req.body.month : '' });
  res.status(201).json({ success: true, data: run });
}));

router.get('/runs/:id', handle(async (req, res) => {
  const run = await loadRun(req);
  if (!run) return res.status(404).json({ success: false, message: 'Run not found' });
  res.json({ success: true, data: run });
}));

// PATCH /api/admin/payroll/runs/:id/items/:staffId  { lopDays?, advanceDue?, adjustments? }
router.patch('/runs/:id/items/:staffId', handle(async (req, res) => {
  const run = await loadRun(req);
  if (!run) return res.status(404).json({ success: false, message: 'Run not found' });
  const b = req.body || {};
  const out = await runs.editItem(run, req.params.staffId, {
    lopDays: b.lopDays !== undefined ? Number(b.lopDays) : undefined,
    advanceDue: b.advanceDue !== undefined ? Number(b.advanceDue) : undefined,
    adjustments: b.adjustments,
  });
  res.json({ success: true, data: out });
}));

router.post('/runs/:id/lock', handle(async (req, res) => {
  const run = await loadRun(req);
  if (!run) return res.status(404).json({ success: false, message: 'Run not found' });
  const locked = await runs.lock(run);
  await logAudit({ subscriberId: sid(req), actingRole: 'admin', actingUserId: req.user.id, module: 'payroll', action: `lock:${run.month}` });
  res.json({ success: true, data: locked });
}));

router.delete('/runs/:id', handle(async (req, res) => {
  const r = await PayrollRun.deleteOne({ _id: req.params.id, subscriberId: sid(req), status: 'draft' });
  if (!r.deletedCount) return res.status(404).json({ success: false, message: 'Draft run not found (locked runs cannot be deleted)' });
  res.json({ success: true });
}));

router.get('/runs/:id/payslip/:staffId', handle(async (req, res) => {
  const run = await loadRun(req);
  const item = run && run.items.find((i) => String(i.staffId) === String(req.params.staffId));
  if (!item) return res.status(404).json({ success: false, message: 'Payslip not found' });
  const sub = await Subscriber.findById(sid(req)).select('gymName');
  streamPayslip(res, { run, item, gymName: sub ? sub.gymName : 'Gym' });
}));

module.exports = router;
