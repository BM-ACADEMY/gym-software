'use strict';
const mongoose = require('mongoose');
const SubAdmin = require('../../models/SubAdmin');
const StaffAttendance = require('../../models/StaffAttendance');
const Payment = require('../../models/Payment');
const Member = require('../../models/Member');
const PayrollRun = require('../../models/PayrollRun');
const StaffAdvance = require('../../models/StaffAdvance');
const { itemFor, totals, bad } = require('./item');

const WORKING_DAYS = 26;
const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

// Start of a month in India time (INR-first). Used for PT commission cut-offs.
const monthBounds = (month) => {
  const [y, m] = month.split('-').map(Number);
  const next = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`;
  return { from: new Date(`${month}-01T00:00:00+05:30`), to: new Date(`${next}-01T00:00:00+05:30`) };
};

// PT money actually collected in the month, per trainer (by the member's assigned trainer).
const ptRevenueByStaff = async (subscriberId, month) => {
  const { from, to } = monthBounds(month);
  const rows = await Payment.aggregate([
    { $match: { subscriberId: new mongoose.Types.ObjectId(String(subscriberId)), category: 'pt_session' } },
    { $unwind: '$installments' },
    { $match: { 'installments.paidAt': { $gte: from, $lt: to } } },
    { $lookup: { from: 'members', localField: 'memberId', foreignField: '_id', as: 'm' } },
    { $unwind: '$m' },
    { $match: { 'm.subscriberId': new mongoose.Types.ObjectId(String(subscriberId)) } },
    { $group: { _id: '$m.assignedSubAdminId', revenue: { $sum: '$installments.amount' } } },
  ]);
  return new Map(rows.filter((r) => r._id).map((r) => [String(r._id), r.revenue]));
};

const owedByStaff = async (subscriberId) => {
  const owed = new Map();
  for (const a of await StaffAdvance.find({ subscriberId }).lean()) {
    const left = a.amount - a.recovered;
    if (left > 0) owed.set(String(a.staffId), (owed.get(String(a.staffId)) || 0) + left);
  }
  return owed;
};

// Draft run: every active staff member with a salary. Loss-of-pay days come from the
// staff attendance sheet (26 working days minus days present or on leave), but ONLY when the
// gym marked attendance for that person; no attendance rows means no deduction.
// The owner can change every figure before locking.
async function createRun({ subscriberId, month }) {
  if (!MONTH_RE.test(String(month || ''))) throw bad('Choose a month like 2026-10.');
  if (await PayrollRun.exists({ subscriberId, month })) throw bad(`A payroll run for ${month} already exists.`);

  const staff = await SubAdmin.find({ subscriberId, isActive: { $ne: false }, baseSalary: { $gt: 0 } }).sort({ name: 1 }).lean();
  if (!staff.length) throw bad('No staff with a monthly salary yet. Set a salary for each person first.');

  const [rows, pt, owed] = await Promise.all([
    StaffAttendance.find({ subscriberId, date: { $gte: `${month}-01`, $lte: `${month}-31` } }).lean(),
    ptRevenueByStaff(subscriberId, month),
    owedByStaff(subscriberId),
  ]);

  const items = staff.map((s) => {
    const mine = rows.filter((r) => String(r.staffId) === String(s._id));
    const present = mine.filter((r) => r.status === 'present').length;
    const leave = mine.filter((r) => r.status === 'leave').length;
    const lop = mine.length ? Math.min(WORKING_DAYS, Math.max(0, WORKING_DAYS - present - leave)) : 0;
    const adj = [];
    const ptRev = pt.get(String(s._id)) || 0;
    const commission = Math.round((ptRev * (s.ptCommissionPercent || 0)) / 100);
    if (commission > 0) adj.push({ label: `PT commission (${s.ptCommissionPercent}% of Rs ${ptRev})`, kind: 'add', amount: commission });
    try {
      const item = itemFor(s, lop, owed.get(String(s._id)) || 0, adj);
      item.daysPresent = present;
      item.daysLeave = leave;
      return item;
    } catch (err) { throw bad(`${s.name}: ${err.message}`); }
  });
  return PayrollRun.create({ subscriberId, month, items, totals: totals(items) });
}

const owedFor = async (subscriberId, staffId) => {
  const list = await StaffAdvance.find({ subscriberId, staffId }).lean();
  return list.reduce((t, a) => t + Math.max(0, a.amount - a.recovered), 0);
};

async function editItem(run, staffId, { lopDays, advanceDue, adjustments }) {
  if (run.status !== 'draft') throw bad('This run is locked.');
  const it = run.items.find((i) => String(i.staffId) === String(staffId));
  if (!it) throw bad('This person is not in the run.');
  if (advanceDue !== undefined) {
    if (!Number.isInteger(advanceDue) || advanceDue < 0) throw bad('Advance recovery must be a whole number of rupees.');
    if (advanceDue > await owedFor(run.subscriberId, staffId)) throw bad('That is more than this person still owes in advances.');
  }
  const next = itemFor(
    { _id: it.staffId, name: it.name, roleTitle: it.roleTitle, baseSalary: it.payslip.gross },
    lopDays !== undefined ? lopDays : it.lopDays,
    advanceDue !== undefined ? advanceDue : it.advanceDue,
    adjustments !== undefined ? adjustments : it.adjustments
  );
  next.daysPresent = it.daysPresent;
  next.daysLeave = it.daysLeave;
  Object.assign(it, next);
  run.markModified('items');
  run.totals = totals(run.items);
  await run.save();
  return run;
}

// Book what a locked run actually recovered against each person's oldest advances first.
// Safe to repeat: an advance that already carries this run's id is skipped.
async function applyAdvances(run) {
  for (const it of run.items) {
    let left = it.payslip.advanceApplied || 0;
    if (left <= 0) continue;
    const advs = await StaffAdvance.find({ subscriberId: run.subscriberId, staffId: it.staffId }).sort({ createdAt: 1 }).lean();
    for (const a of advs) {
      if (left <= 0) break;
      const done = (a.recoveries || []).find((r) => String(r.runId) === String(run._id));
      if (done) { left -= done.amount; continue; }
      const take = Math.min(left, a.amount - a.recovered);
      if (take <= 0) continue;
      const r = await StaffAdvance.updateOne(
        { _id: a._id, 'recoveries.runId': { $ne: run._id } },
        { $push: { recoveries: { runId: run._id, amount: take } }, $inc: { recovered: take } }
      );
      if (r.modifiedCount) left -= take;
    }
  }
}

async function lock(run) {
  if (run.status === 'locked') { await applyAdvances(run); return run; } // repair after a crash
  const claimed = await PayrollRun.findOneAndUpdate({ _id: run._id, subscriberId: run.subscriberId, status: 'draft' }, { $set: { status: 'locked', lockedAt: new Date() } }, { new: true });
  if (!claimed) throw bad('This run is already locked.');
  await applyAdvances(claimed);
  return claimed;
}

module.exports = { createRun, editItem, lock, applyAdvances, ptRevenueByStaff, WORKING_DAYS, monthBounds };
