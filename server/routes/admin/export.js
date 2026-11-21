const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../../middleware/auth');
const Member = require('../../models/Member');
const Payment = require('../../models/Payment');
const Attendance = require('../../models/Attendance');
const { logAudit } = require('../../utils/auditLog');

router.use(protect, authorize('admin'));

// A spreadsheet opens "=cmd" or "+1+1" as a formula. Prefix risky starts with a quote.
const cell = (v) => {
  if (v === null || v === undefined) return '';
  let s = v instanceof Date ? v.toISOString() : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const toCsv = (header, rows) => [header.join(','), ...rows.map((r) => r.map(cell).join(','))].join('\r\n') + '\r\n';

const send = (res, name, csv) => {
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${name}"`);
  res.send('﻿' + csv); // BOM so Excel reads Tamil/Hindi names correctly
};

const LIMIT = 50000;

// GET /api/admin/export/members.csv  (works even when the plan has ended: read-only still allows export)
router.get('/members.csv', async (req, res) => {
  try {
    const subscriberId = req.user.subscriberId;
    const members = await Member.find({ subscriberId }).select('name phone email gender status joinedAt createdAt expiresAt deviceUserId goal').limit(LIMIT).lean();
    await logAudit({ subscriberId, actingRole: 'admin', actingUserId: req.user.id, module: 'export', action: `members:${members.length}` });
    send(res, 'members.csv', toCsv(
      ['Name', 'Phone', 'Email', 'Gender', 'Status', 'Joined', 'Valid till', 'Device ID', 'Goal'],
      members.map((m) => [m.name, m.phone, m.email, m.gender, m.status, m.joinedAt || m.createdAt, m.expiresAt, m.deviceUserId, m.goal])
    ));
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// GET /api/admin/export/payments.csv
router.get('/payments.csv', async (req, res) => {
  try {
    const subscriberId = req.user.subscriberId;
    const payments = await Payment.find({ subscriberId }).populate('memberId', 'name phone').limit(LIMIT).lean();
    await logAudit({ subscriberId, actingRole: 'admin', actingUserId: req.user.id, module: 'export', action: `payments:${payments.length}` });
    send(res, 'payments.csv', toCsv(
      ['Member', 'Phone', 'Amount', 'Paid', 'Balance', 'Status', 'Method', 'Category', 'Due date', 'Created'],
      payments.map((p) => [p.memberId?.name, p.memberId?.phone, p.amount, p.amountPaid || 0, p.amount - (p.amountPaid || 0), p.status, p.method, p.category, p.dueDate, p.createdAt])
    ));
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// GET /api/admin/export/attendance.csv
router.get('/attendance.csv', async (req, res) => {
  try {
    const subscriberId = req.user.subscriberId;
    const rows = await Attendance.find({ subscriberId }).sort({ checkedInAt: -1 }).populate('memberId', 'name phone').limit(LIMIT).lean();
    await logAudit({ subscriberId, actingRole: 'admin', actingUserId: req.user.id, module: 'export', action: `attendance:${rows.length}` });
    send(res, 'attendance.csv', toCsv(
      ['Member', 'Phone', 'Checked in', 'Method'],
      rows.map((a) => [a.memberId?.name, a.memberId?.phone, a.checkedInAt, a.method])
    ));
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
module.exports.toCsv = toCsv;
module.exports.cell = cell;
