const mongoose = require('mongoose');
const Payment = require('../../models/Payment');
const Member = require('../../models/Member');
const SubAdmin = require('../../models/SubAdmin');

const getModulePermission = (subAdmin, moduleKey) =>
  subAdmin?.permissions?.get?.(moduleKey) || subAdmin?.permissions?.[moduleKey];

const getSubAdminScope = (req) => {
  if (req.user.role !== 'subadmin') return { scoped: false };
  const perm = getModulePermission(req.subAdmin, 'earnings');
  return { scoped: !perm?.viewAll, subAdminId: req.user.id };
};

// Defaults to the current calendar month when no range is given.
const getPeriod = (query) => {
  const now = new Date();
  const dateFrom = query.dateFrom ? new Date(query.dateFrom) : new Date(now.getFullYear(), now.getMonth(), 1);
  let dateTo;
  if (query.dateTo) {
    dateTo = new Date(query.dateTo);
    dateTo.setHours(23, 59, 59, 999);
  } else {
    dateTo = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  }
  return { dateFrom, dateTo };
};

// @desc    Revenue breakdown (membership vs PT session vs other) and per-trainer
//          commission payout for a period — self-scoped to "own only" for a sub-admin
// @route   GET /api/admin/earnings  |  GET /api/subadmin/earnings (view)
const getEarnings = async (req, res) => {
  try {
    const { dateFrom, dateTo } = getPeriod(req.query);
    const subscriberId = new mongoose.Types.ObjectId(req.user.subscriberId);

    const { scoped, subAdminId } = getSubAdminScope(req);
    let ownMemberIds;
    if (scoped) {
      ownMemberIds = await Member.find({ subscriberId: req.user.subscriberId, assignedSubAdminId: subAdminId }).distinct('_id');
    }

    const basePipeline = [
      { $match: { subscriberId, ...(scoped && { memberId: { $in: ownMemberIds } }) } },
      { $unwind: '$installments' },
      { $match: { 'installments.paidAt': { $gte: dateFrom, $lt: dateTo } } },
    ];

    const categoryAgg = await Payment.aggregate([
      ...basePipeline,
      { $group: { _id: '$category', total: { $sum: '$installments.amount' } } },
    ]);
    const byCategory = { membership: 0, pt_session: 0, other: 0 };
    categoryAgg.forEach((c) => { byCategory[c._id || 'membership'] = c.total; });
    const total = byCategory.membership + byCategory.pt_session + byCategory.other;

    const trainerAgg = await Payment.aggregate([
      ...basePipeline,
      { $lookup: { from: 'members', localField: 'memberId', foreignField: '_id', as: 'member' } },
      { $unwind: '$member' },
      {
        $group: {
          _id: '$member.assignedSubAdminId',
          revenue: { $sum: '$installments.amount' },
          ptRevenue: { $sum: { $cond: [{ $eq: ['$category', 'pt_session'] }, '$installments.amount', 0] } },
        },
      },
    ]);

    // A scoped trainer may not have any payments yet this period (no revenue
    // rows to aggregate) — make sure their own salary/commission-rate card
    // still renders by seeding their id into the lookup set regardless.
    const trainerIds = trainerAgg.map((t) => t._id).filter(Boolean);
    if (scoped && !trainerIds.some((id) => String(id) === String(subAdminId))) trainerIds.push(subAdminId);
    const trainers = await SubAdmin.find({ _id: { $in: trainerIds } }).select('name ptCommissionPercent baseSalary');
    const trainerById = new Map(trainers.map((t) => [String(t._id), t]));

    const byTrainer = trainerIds
      .map((id) => {
        const agg = trainerAgg.find((t) => String(t._id) === String(id)) || { revenue: 0, ptRevenue: 0 };
        const trainer = trainerById.get(String(id));
        const commissionPercent = trainer?.ptCommissionPercent || 0;
        return {
          trainerId: id,
          trainerName: trainer?.name || 'Unknown',
          revenue: agg.revenue,
          ptRevenue: agg.ptRevenue,
          commissionPercent,
          commissionPayout: Math.round((agg.ptRevenue * commissionPercent) / 100),
          baseSalary: trainer?.baseSalary ?? null,
        };
      })
      .sort((a, b) => b.revenue - a.revenue);

    res.status(200).json({
      success: true,
      message: 'Earnings fetched successfully',
      data: { period: { dateFrom, dateTo }, total, byCategory, byTrainer },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

module.exports = { getEarnings };
