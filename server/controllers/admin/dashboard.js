const mongoose = require('mongoose');
const Member = require('../../models/Member');
const Attendance = require('../../models/Attendance');
const Payment = require('../../models/Payment');

const getModulePermission = (subAdmin, moduleKey) =>
  subAdmin?.permissions?.get?.(moduleKey) || subAdmin?.permissions?.[moduleKey];

const getSubAdminScope = (req) => {
  if (req.user.role !== 'subadmin') return { scoped: false };
  const perm = getModulePermission(req.subAdmin, 'dashboard');
  return { scoped: !perm?.viewAll, subAdminId: req.user.id };
};

// @desc    Real-data overview for the Gym Owner / Sub-Admin dashboard
//          (AI-driven widgets — no-show prediction, retention-risk list — land in a later task)
// @route   GET /api/admin/dashboard  |  GET /api/subadmin/dashboard (view)
const getDashboard = async (req, res) => {
  try {
    const subscriberId = new mongoose.Types.ObjectId(req.user.subscriberId);
    const now = new Date();
    const dayStart = new Date(now); dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(dayStart); dayEnd.setDate(dayEnd.getDate() + 1);
    const weekEnd = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);

    const { scoped, subAdminId } = getSubAdminScope(req);
    let ownMemberIds;
    if (scoped) {
      ownMemberIds = await Member.find({ subscriberId: req.user.subscriberId, assignedSubAdminId: subAdminId }).distinct('_id');
    }

    const memberFilter = { subscriberId: req.user.subscriberId, ...(scoped && { assignedSubAdminId: subAdminId }) };
    const attendanceFilter = { subscriberId: req.user.subscriberId, ...(scoped && { memberId: { $in: ownMemberIds } }) };
    const paymentMatch = { subscriberId, ...(scoped && { memberId: { $in: ownMemberIds } }) };

    const [
      todaysCheckIns,
      activeMembers,
      expiringThisWeek,
      revenueAgg,
      pendingAgg,
    ] = await Promise.all([
      Attendance.countDocuments({ ...attendanceFilter, checkedInAt: { $gte: dayStart, $lt: dayEnd } }),
      Member.countDocuments({ ...memberFilter, status: 'active', $or: [{ expiresAt: null }, { expiresAt: { $gt: now } }] }),
      Member.countDocuments({ ...memberFilter, status: 'active', expiresAt: { $gt: now, $lte: weekEnd } }),
      Payment.aggregate([
        { $match: paymentMatch },
        { $unwind: '$installments' },
        { $match: { 'installments.paidAt': { $gte: monthStart, $lt: monthEnd } } },
        { $group: { _id: null, total: { $sum: '$installments.amount' } } },
      ]),
      Payment.aggregate([
        { $match: { ...paymentMatch, status: { $in: ['pending', 'partial'] } } },
        { $group: { _id: null, total: { $sum: { $subtract: ['$amount', '$amountPaid'] } }, count: { $sum: 1 } } },
      ]),
    ]);

    res.status(200).json({
      success: true,
      message: 'Dashboard fetched successfully',
      data: {
        todaysCheckIns,
        activeMembers,
        expiringThisWeek,
        revenueThisMonth: revenueAgg[0]?.total || 0,
        pendingPayments: { count: pendingAgg[0]?.count || 0, amount: pendingAgg[0]?.total || 0 },
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

module.exports = { getDashboard };
