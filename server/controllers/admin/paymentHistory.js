const mongoose = require('mongoose');
const Payment = require('../../models/Payment');
const Member = require('../../models/Member');

const getModulePermission = (subAdmin, moduleKey) =>
  subAdmin?.permissions?.get?.(moduleKey) || subAdmin?.permissions?.[moduleKey];

const getSubAdminScope = (req) => {
  if (req.user.role !== 'subadmin') return { scoped: false };
  const perm = getModulePermission(req.subAdmin, 'payment-history');
  return { scoped: !perm?.viewAll, subAdminId: req.user.id };
};

// Flattens every installment across every invoice into individual ledger
// rows — a "ledger" is transactions, not invoices, so each money movement
// gets its own row even when several belong to the same partially-paid invoice.
const buildLedgerPipeline = async (req) => {
  const { memberId, method, status, dateFrom, dateTo } = req.query;

  const match = { subscriberId: new mongoose.Types.ObjectId(req.user.subscriberId) };
  if (memberId) match.memberId = new mongoose.Types.ObjectId(memberId);
  if (status) match.status = status;

  const { scoped, subAdminId } = getSubAdminScope(req);
  if (scoped && !memberId) {
    const ownMemberIds = await Member.find({ subscriberId: req.user.subscriberId, assignedSubAdminId: subAdminId }).distinct('_id');
    match.memberId = { $in: ownMemberIds };
  }

  const pipeline = [{ $match: match }, { $unwind: '$installments' }];

  const installmentMatch = {};
  if (method) installmentMatch['installments.method'] = method;
  if (dateFrom || dateTo) {
    const range = {};
    if (dateFrom) range.$gte = new Date(dateFrom);
    if (dateTo) { const end = new Date(dateTo); end.setHours(23, 59, 59, 999); range.$lte = end; }
    installmentMatch['installments.paidAt'] = range;
  }
  if (Object.keys(installmentMatch).length) pipeline.push({ $match: installmentMatch });

  pipeline.push(
    { $lookup: { from: 'members', localField: 'memberId', foreignField: '_id', as: 'member' } },
    { $unwind: '$member' },
    {
      $project: {
        _id: 0,
        paymentId: '$_id',
        invoiceNumber: 1,
        memberId: '$member._id',
        memberName: '$member.name',
        memberPhone: '$member.phone',
        amount: '$installments.amount',
        method: '$installments.method',
        note: '$installments.note',
        paidAt: '$installments.paidAt',
        invoiceStatus: '$status',
        invoiceTotal: '$amount',
        invoiceAmountPaid: '$amountPaid',
      },
    },
    { $sort: { paidAt: -1 } }
  );

  return pipeline;
};

// @desc    Full transaction ledger (every installment across every invoice), filterable
// @route   GET /api/admin/payment-history  |  GET /api/subadmin/payment-history (view)
const listLedger = async (req, res) => {
  try {
    const pipeline = await buildLedgerPipeline(req);
    const rows = await Payment.aggregate(pipeline);
    const total = rows.reduce((sum, r) => sum + r.amount, 0);
    res.status(200).json({ success: true, message: 'Payment history fetched successfully', data: { rows, total, count: rows.length } });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const escapeCsv = (value) => {
  const str = String(value ?? '');
  return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
};

// @desc    Export the same ledger (with the same filters) as a CSV file
// @route   GET /api/admin/payment-history/export  |  GET /api/subadmin/payment-history/export (view)
const exportLedger = async (req, res) => {
  try {
    const pipeline = await buildLedgerPipeline(req);
    const rows = await Payment.aggregate(pipeline);

    const header = ['Date', 'Member', 'Phone', 'Invoice', 'Amount', 'Method', 'Invoice Status', 'Note'];
    const lines = [header.join(',')];
    for (const r of rows) {
      lines.push([
        new Date(r.paidAt).toISOString(),
        escapeCsv(r.memberName),
        escapeCsv(r.memberPhone),
        escapeCsv(r.invoiceNumber),
        r.amount,
        r.method,
        r.invoiceStatus,
        escapeCsv(r.note),
      ].join(','));
    }

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="payment-history.csv"');
    res.status(200).send(lines.join('\n'));
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

module.exports = { listLedger, exportLedger };
