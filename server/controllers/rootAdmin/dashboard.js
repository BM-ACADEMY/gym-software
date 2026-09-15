const Subscriber = require('../../models/Subscriber');
const Admin = require('../../models/Admin');
const Member = require('../../models/Member');
const { computeSubscriberChurnRisk } = require('../../services/ai');

// AI: per-gym churn-risk flag, scored from login activity + platform plan
// expiry proximity + a falling member-count trend (see services/ai.js).
// Capped to a bounded pool of active subscribers for cost.
const getChurnRiskSubscribers = async () => {
  const now = new Date();
  const last30Days = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const subscribers = await Subscriber.find({ isActive: true }).select('gymName nextBillingDate').limit(50);
  if (subscribers.length === 0) return [];

  const results = await Promise.all(
    subscribers.map(async (subscriber) => {
      const [admin, activeMemberCount, newMembers30d, churnedMembers30d] = await Promise.all([
        Admin.findOne({ subscriberId: subscriber._id }).select('lastLoginAt createdAt'),
        Member.countDocuments({ subscriberId: subscriber._id, status: 'active' }),
        Member.countDocuments({ subscriberId: subscriber._id, createdAt: { $gte: last30Days } }),
        Member.countDocuments({ subscriberId: subscriber._id, status: { $in: ['expired', 'cancelled'] }, updatedAt: { $gte: last30Days } }),
      ]);

      const lastActivity = admin?.lastLoginAt || admin?.createdAt;
      const loginGapDays = lastActivity ? Math.floor((now - lastActivity) / (24 * 60 * 60 * 1000)) : 999;

      const platformDaysUntilExpiry = subscriber.nextBillingDate
        ? Math.ceil((subscriber.nextBillingDate - now) / (24 * 60 * 60 * 1000))
        : null;

      // Prior-period count approximated by working backward from today's
      // count through this period's known joins/losses — not a stored
      // historical snapshot, but a reasonable trend proxy.
      const priorCount = Math.max(0, activeMemberCount - newMembers30d + churnedMembers30d);
      const memberCountChangePct = priorCount > 0 ? (activeMemberCount - priorCount) / priorCount : 0;

      const risk = computeSubscriberChurnRisk({ loginGapDays, platformDaysUntilExpiry, memberCountChangePct });
      return { subscriberId: subscriber._id, gymName: subscriber.gymName, ...risk };
    })
  );

  return results.filter((r) => r.score > 0).sort((a, b) => b.score - a.score).slice(0, 5);
};

// @desc    Platform overview: MRR, ARR, subscriber counts, trials, churn, new
//          signups, plus the AI per-gym churn-risk flag.
// @route   GET /api/root-admin/dashboard
const getDashboard = async (req, res) => {
  try {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const last7Days = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const last30Days = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const [
      activeSubscribersWithPlan,
      totalSubscribers,
      activeCount,
      inactiveCount,
      trialsInProgress,
      churnedThisMonth,
      newSignups7Day,
      newSignups30Day,
      churnRiskSubscribers,
    ] = await Promise.all([
      Subscriber.find({ isActive: true, platformPlanId: { $ne: null } }).populate('platformPlanId', 'price'),
      Subscriber.countDocuments(),
      Subscriber.countDocuments({ isActive: true }),
      Subscriber.countDocuments({ isActive: false }),
      Subscriber.countDocuments({ trialEndsAt: { $gt: now } }),
      Subscriber.countDocuments({ isActive: false, updatedAt: { $gte: monthStart } }),
      Subscriber.countDocuments({ createdAt: { $gte: last7Days } }),
      Subscriber.countDocuments({ createdAt: { $gte: last30Days } }),
      getChurnRiskSubscribers(),
    ]);

    // MRR is a snapshot metric — "what active subscribers are billed monthly
    // right now" — not actual PlatformPayment collections (that's Billing's job).
    const mrr = activeSubscribersWithPlan.reduce((sum, s) => sum + (s.platformPlanId?.price || 0), 0);

    res.status(200).json({
      success: true,
      message: 'Dashboard fetched successfully',
      data: {
        mrr,
        arr: mrr * 12,
        totalSubscribers,
        activeCount,
        inactiveCount,
        trialsInProgress,
        churnedThisMonth,
        newSignups7Day,
        newSignups30Day,
        planLessActiveCount: activeCount - activeSubscribersWithPlan.length,
        churnRiskSubscribers,
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

module.exports = { getDashboard };
