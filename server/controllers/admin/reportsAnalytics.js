const mongoose = require('mongoose');
const Attendance = require('../../models/Attendance');
const Payment = require('../../models/Payment');
const Member = require('../../models/Member');
const { generateMonthlyNarrative } = require('../../services/ai');

// Defaults to the last 30 days when no range is given.
const getPeriod = (query) => {
  const now = new Date();
  const dateFrom = query.dateFrom ? new Date(query.dateFrom) : new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  let dateTo;
  if (query.dateTo) {
    dateTo = new Date(query.dateTo);
    dateTo.setHours(23, 59, 59, 999);
  } else {
    dateTo = now;
  }
  return { dateFrom, dateTo };
};

const dayBucket = (dateField) => ({ $dateToString: { format: '%Y-%m-%d', date: dateField } });

// @desc    Attendance trend, revenue trend, member growth, and a churn/retention
//          estimate for this gym over a period (defaults to the last 30 days).
//          The AI monthly narrative summary is a later, separate task.
// @route   GET /api/admin/reports-analytics
const getReports = async (req, res) => {
  try {
    const { dateFrom, dateTo } = getPeriod(req.query);
    const subscriberId = new mongoose.Types.ObjectId(req.user.subscriberId);

    const [attendanceTrend, revenueTrend, memberGrowth, activeMembers, newMembersThisPeriod, churnedThisPeriod] = await Promise.all([
      Attendance.aggregate([
        { $match: { subscriberId, checkedInAt: { $gte: dateFrom, $lt: dateTo } } },
        { $group: { _id: dayBucket('$checkedInAt'), count: { $sum: 1 } } },
        { $sort: { _id: 1 } },
      ]),
      Payment.aggregate([
        { $match: { subscriberId } },
        { $unwind: '$installments' },
        { $match: { 'installments.paidAt': { $gte: dateFrom, $lt: dateTo } } },
        { $group: { _id: dayBucket('$installments.paidAt'), total: { $sum: '$installments.amount' } } },
        { $sort: { _id: 1 } },
      ]),
      Member.aggregate([
        { $match: { subscriberId, createdAt: { $gte: dateFrom, $lt: dateTo } } },
        { $group: { _id: dayBucket('$createdAt'), newMembers: { $sum: 1 } } },
        { $sort: { _id: 1 } },
      ]),
      Member.countDocuments({ subscriberId: req.user.subscriberId, status: 'active', $or: [{ expiresAt: null }, { expiresAt: { $gt: new Date() } }] }),
      Member.countDocuments({ subscriberId: req.user.subscriberId, createdAt: { $gte: dateFrom, $lt: dateTo } }),
      Member.countDocuments({ subscriberId: req.user.subscriberId, status: { $in: ['expired', 'cancelled'] }, updatedAt: { $gte: dateFrom, $lt: dateTo } }),
    ]);

    // Retention/churn approximation: there's no status-change history log, so
    // "churned this period" is inferred from updatedAt on an expired/cancelled
    // record — a reasonable proxy, not an exact cohort calculation.
    const churnBase = activeMembers + churnedThisPeriod;
    const churnRate = churnBase > 0 ? churnedThisPeriod / churnBase : 0;

    const formattedAttendanceTrend = attendanceTrend.map((d) => ({ date: d._id, count: d.count }));
    const formattedRevenueTrend = revenueTrend.map((d) => ({ date: d._id, total: d.total }));
    const formattedMemberGrowth = memberGrowth.map((d) => ({ date: d._id, newMembers: d.newMembers }));
    const retention = {
      activeMembers,
      newMembersThisPeriod,
      churnedThisPeriod,
      churnRate: Math.round(churnRate * 1000) / 1000,
      retentionRate: Math.round((1 - churnRate) * 1000) / 1000,
    };

    const narrative = generateMonthlyNarrative({
      attendanceTrend: formattedAttendanceTrend,
      revenueTrend: formattedRevenueTrend,
      memberGrowth: formattedMemberGrowth,
      retention,
    });

    res.status(200).json({
      success: true,
      message: 'Reports fetched successfully',
      data: {
        period: { dateFrom, dateTo },
        attendanceTrend: formattedAttendanceTrend,
        revenueTrend: formattedRevenueTrend,
        memberGrowth: formattedMemberGrowth,
        retention,
        narrative,
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

module.exports = { getReports };
