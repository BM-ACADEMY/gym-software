const crypto = require('crypto');
const mongoose = require('mongoose');
const Payment = require('../../models/Payment');
const Member = require('../../models/Member');

const getModulePermission = (subAdmin, moduleKey) =>
  subAdmin?.permissions?.get?.(moduleKey) || subAdmin?.permissions?.[moduleKey];

const getSubAdminScope = (req) => {
  if (req.user.role !== 'subadmin') return { scoped: false };
  const perm = getModulePermission(req.subAdmin, 'payment');
  return { scoped: !perm?.viewAll, subAdminId: req.user.id };
};

const generateInvoiceNumber = () =>
  `INV-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;

// A record is "overdue" (display-only — never persisted as such) when it's
// not fully paid and past its due date. Mirrors the Members effectiveStatus pattern.
const withEffectiveStatus = (paymentDoc) => {
  const payment = paymentDoc.toObject ? paymentDoc.toObject() : paymentDoc;
  let effectiveStatus = payment.status;
  if (['pending', 'partial'].includes(payment.status) && payment.dueDate && new Date(payment.dueDate) < new Date()) {
    effectiveStatus = 'overdue';
  }
  return { ...payment, balanceDue: Math.max(0, payment.amount - payment.amountPaid), effectiveStatus };
};

const resolveStatus = (amount, amountPaid) => {
  if (amountPaid <= 0) return 'pending';
  if (amountPaid >= amount) return 'paid';
  return 'partial';
};

// Members visible to a scoped sub-admin, for filtering payments by ownership
// (Payment has no assignedSubAdminId of its own — it belongs to a member).
const getOwnMemberIds = async (req, subAdminId) =>
  Member.find({ subscriberId: req.user.subscriberId, assignedSubAdminId: subAdminId }).distinct('_id');

// @desc    Record a new payment/invoice for a member (first installment counts as the initial payment)
// @route   POST /api/admin/payment  |  POST /api/subadmin/payment (edit)
const createPayment = async (req, res) => {
  try {
    const { memberId, amount, amountNow, method, dueDate, note } = req.body;

    if (!memberId || !amount || amount <= 0 || !method) {
      return res.status(400).json({ success: false, message: 'memberId, a positive amount, and method are required' });
    }

    const member = await Member.findOne({ _id: memberId, subscriberId: req.user.subscriberId });
    if (!member) {
      return res.status(404).json({ success: false, message: 'Member not found' });
    }

    const { scoped, subAdminId } = getSubAdminScope(req);
    if (scoped && String(member.assignedSubAdminId) !== String(subAdminId)) {
      return res.status(403).json({ success: false, message: 'This member is not assigned to you' });
    }

    const firstPayment = amountNow !== undefined ? Number(amountNow) : Number(amount);
    if (firstPayment < 0 || firstPayment > Number(amount)) {
      return res.status(400).json({ success: false, message: 'Initial payment cannot exceed the total amount due' });
    }

    const payment = await Payment.create({
      subscriberId: req.user.subscriberId,
      memberId,
      amount: Number(amount),
      amountPaid: firstPayment,
      installments: firstPayment > 0 ? [{ amount: firstPayment, method, note }] : [],
      dueDate,
      method,
      note,
      status: resolveStatus(Number(amount), firstPayment),
      invoiceNumber: generateInvoiceNumber(),
      paidAt: firstPayment > 0 ? new Date() : undefined,
    });

    res.status(201).json({ success: true, message: 'Payment recorded successfully', data: withEffectiveStatus(payment) });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Add an installment toward an existing invoice's remaining balance
// @route   PATCH /api/admin/payment/:id/installment  |  PATCH /api/subadmin/payment/:id/installment (edit)
const addInstallment = async (req, res) => {
  try {
    const { amount, method, note } = req.body;
    if (!amount || amount <= 0 || !method) {
      return res.status(400).json({ success: false, message: 'A positive amount and method are required' });
    }

    const payment = await Payment.findOne({ _id: req.params.id, subscriberId: req.user.subscriberId });
    if (!payment) {
      return res.status(404).json({ success: false, message: 'Payment not found' });
    }

    const { scoped, subAdminId } = getSubAdminScope(req);
    if (scoped) {
      const member = await Member.findById(payment.memberId).select('assignedSubAdminId');
      if (!member || String(member.assignedSubAdminId) !== String(subAdminId)) {
        return res.status(403).json({ success: false, message: 'This member is not assigned to you' });
      }
    }

    if (payment.status === 'paid') {
      return res.status(400).json({ success: false, message: 'This invoice is already fully paid' });
    }
    if (payment.status === 'refunded') {
      return res.status(400).json({ success: false, message: 'This invoice has been refunded' });
    }

    const remaining = payment.amount - payment.amountPaid;
    if (Number(amount) > remaining) {
      return res.status(400).json({ success: false, message: `Amount exceeds the remaining balance of ${remaining}` });
    }

    payment.installments.push({ amount: Number(amount), method, note });
    payment.amountPaid += Number(amount);
    payment.method = method;
    payment.status = resolveStatus(payment.amount, payment.amountPaid);
    payment.paidAt = new Date();
    await payment.save();

    res.status(200).json({ success: true, message: 'Installment recorded successfully', data: withEffectiveStatus(payment) });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Mark a payment refunded
// @route   PATCH /api/admin/payment/:id/refund  |  PATCH /api/subadmin/payment/:id/refund (edit)
const refundPayment = async (req, res) => {
  try {
    const payment = await Payment.findOne({ _id: req.params.id, subscriberId: req.user.subscriberId });
    if (!payment) {
      return res.status(404).json({ success: false, message: 'Payment not found' });
    }
    payment.status = 'refunded';
    await payment.save();
    res.status(200).json({ success: true, message: 'Payment marked as refunded', data: withEffectiveStatus(payment) });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    List payments (most recent first), optionally filtered
// @route   GET /api/admin/payment  |  GET /api/subadmin/payment (view)
const listPayments = async (req, res) => {
  try {
    const { memberId, status } = req.query;
    const query = { subscriberId: req.user.subscriberId };
    if (memberId) query.memberId = memberId;

    const { scoped, subAdminId } = getSubAdminScope(req);
    if (scoped) {
      const ownMemberIds = await getOwnMemberIds(req, subAdminId);
      query.memberId = query.memberId ? query.memberId : { $in: ownMemberIds };
    }

    let payments = await Payment.find(query).populate('memberId', 'name phone').sort({ createdAt: -1 }).limit(200);
    let results = payments.map(withEffectiveStatus);
    if (status) results = results.filter((p) => p.effectiveStatus === status);

    res.status(200).json({ success: true, message: 'Payments fetched successfully', data: results });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Invoices that are unpaid/partial and past their due date
// @route   GET /api/admin/payment/overdue  |  GET /api/subadmin/payment/overdue (view)
const listOverdue = async (req, res) => {
  try {
    const query = {
      subscriberId: req.user.subscriberId,
      status: { $in: ['pending', 'partial'] },
      dueDate: { $lt: new Date() },
    };

    const { scoped, subAdminId } = getSubAdminScope(req);
    if (scoped) {
      const ownMemberIds = await getOwnMemberIds(req, subAdminId);
      query.memberId = { $in: ownMemberIds };
    }

    const overdue = await Payment.find(query).populate('memberId', 'name phone').sort({ dueDate: 1 });
    res.status(200).json({ success: true, message: 'Overdue payments fetched successfully', data: overdue.map(withEffectiveStatus) });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Quick stats for the Payment page header: collected today, total pending dues
// @route   GET /api/admin/payment/today-summary  |  GET /api/subadmin/payment/today-summary (view)
const todaySummary = async (req, res) => {
  try {
    const start = new Date(); start.setHours(0, 0, 0, 0);
    const end = new Date(start); end.setDate(end.getDate() + 1);

    // aggregate()'s $match does raw BSON comparison — unlike find(), it does
    // NOT auto-cast a plain string (req.user.subscriberId, as decoded from the
    // JWT) against the schema's ObjectId type, so it must be cast explicitly here.
    const baseQuery = { subscriberId: new mongoose.Types.ObjectId(req.user.subscriberId) };
    const { scoped, subAdminId } = getSubAdminScope(req);
    if (scoped) {
      const ownMemberIds = await getOwnMemberIds(req, subAdminId);
      baseQuery.memberId = { $in: ownMemberIds };
    }

    const [collectedTodayAgg, pendingAgg] = await Promise.all([
      Payment.aggregate([
        { $match: { ...baseQuery, paidAt: { $gte: start, $lt: end } } },
        { $unwind: '$installments' },
        { $match: { 'installments.paidAt': { $gte: start, $lt: end } } },
        { $group: { _id: null, total: { $sum: '$installments.amount' }, count: { $sum: 1 } } },
      ]),
      Payment.aggregate([
        { $match: { ...baseQuery, status: { $in: ['pending', 'partial'] } } },
        { $group: { _id: null, total: { $sum: { $subtract: ['$amount', '$amountPaid'] } }, count: { $sum: 1 } } },
      ]),
    ]);

    res.status(200).json({
      success: true,
      message: 'Summary fetched successfully',
      data: {
        collectedToday: collectedTodayAgg[0]?.total || 0,
        collectedTodayCount: collectedTodayAgg[0]?.count || 0,
        pendingDues: pendingAgg[0]?.total || 0,
        pendingDuesCount: pendingAgg[0]?.count || 0,
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

module.exports = { createPayment, addInstallment, refundPayment, listPayments, listOverdue, todaySummary };
