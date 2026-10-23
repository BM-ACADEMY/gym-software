const mongoose = require('mongoose');
const Member = require('../../models/Member');
const Attendance = require('../../models/Attendance');
const Payment = require('../../models/Payment');
const PTSession = require('../../models/PTSession');
const { computeMemberChurnRisk } = require('../../services/ai');

const getModulePermission = (subAdmin, moduleKey) =>
  subAdmin?.permissions?.get?.(moduleKey) || subAdmin?.permissions?.[moduleKey];

const getSubAdminScope = (req) => {
  if (req.user.role !== 'subadmin') return { scoped: false };
  const perm = getModulePermission(req.subAdmin, 'dashboard');
  return { scoped: !perm?.viewAll, subAdminId: req.user.id };
};

// AI: retention-risk member list, scored from attendance drop + plan expiry
// proximity + overdue payments (see services/ai.js#computeMemberChurnRisk).
// Capped to a bounded candidate pool for cost, and only members with any
// nonzero risk are returned.
const getRetentionRiskMembers = async ({ subscriberId, memberFilter }) => {
  const now = new Date();
  const recentStart = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
  const priorStart = new Date(now.getTime() - 28 * 24 * 60 * 60 * 1000);

  const activeMembers = await Member.find({ ...memberFilter, status: 'active' }).select('name expiresAt').limit(50);
  if (activeMembers.length === 0) return [];
  const activeMemberIds = activeMembers.map((m) => m._id);

  const [attendanceAgg, overdueMemberIds] = await Promise.all([
    Attendance.aggregate([
      { $match: { subscriberId, memberId: { $in: activeMemberIds }, checkedInAt: { $gte: priorStart } } },
      {
        $group: {
          _id: '$memberId',
          recentCheckIns: { $sum: { $cond: [{ $gte: ['$checkedInAt', recentStart] }, 1, 0] } },
          priorCheckIns: { $sum: { $cond: [{ $and: [{ $gte: ['$checkedInAt', priorStart] }, { $lt: ['$checkedInAt', recentStart] }] }, 1, 0] } },
        },
      },
    ]),
    Payment.find({ subscriberId, memberId: { $in: activeMemberIds }, status: { $in: ['pending', 'partial'] }, dueDate: { $lt: now } }).distinct('memberId'),
  ]);

  const attendanceByMember = new Map(attendanceAgg.map((a) => [String(a._id), a]));
  const overdueSet = new Set(overdueMemberIds.map(String));

  return activeMembers
    .map((member) => {
      const attendance = attendanceByMember.get(String(member._id)) || { recentCheckIns: 0, priorCheckIns: 0 };
      const daysUntilExpiry = member.expiresAt ? Math.ceil((member.expiresAt - now) / (24 * 60 * 60 * 1000)) : null;
      const risk = computeMemberChurnRisk({
        recentCheckIns: attendance.recentCheckIns,
        priorCheckIns: attendance.priorCheckIns,
        daysUntilExpiry,
        hasOverduePayment: overdueSet.has(String(member._id)),
      });
      return { memberId: member._id, name: member.name, ...risk };
    })
    .filter((m) => m.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);
};

// @desc    Real-data overview for the Gym Owner / Sub-Admin dashboard, plus
//          the AI retention-risk member list (no-show prediction lives on
//          PT Sessions instead, where a booking actually exists to flag)
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
    const sessionFilter = { subscriberId: req.user.subscriberId, ...(scoped && { subAdminId }) };

    const [
      todaysCheckIns,
      activeMembers,
      expiringThisWeek,
      revenueAgg,
      pendingAgg,
      retentionRiskMembers,
      todaysSessions,
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
      getRetentionRiskMembers({ subscriberId, memberFilter }),
      PTSession.find({ ...sessionFilter, scheduledAt: { $gte: dayStart, $lt: dayEnd }, status: { $ne: 'cancelled' } })
        .sort({ scheduledAt: 1 })
        .limit(20)
        .populate('memberId', 'name')
        .select('scheduledAt status memberId'),
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
        retentionRiskMembers,
        todaysSessions: todaysSessions.map((s) => ({
          _id: s._id,
          scheduledAt: s.scheduledAt,
          status: s.status,
          memberName: s.memberId?.name || 'Unknown member',
        })),
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

module.exports = { getDashboard };
