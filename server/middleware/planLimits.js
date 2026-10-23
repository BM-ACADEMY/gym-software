const Subscriber = require('../models/Subscriber');
const PlatformPlan = require('../models/PlatformPlan');
const Member = require('../models/Member');
const SubAdmin = require('../models/SubAdmin');

// Enforces the platform plan's memberLimit / staffLimit on the server so a
// gym cannot exceed its plan by calling the API directly. A gym with no
// platform plan, or a plan with no limit set, is unlimited (pilot gyms).
// Cancelled members do not count toward the limit.
const COUNTED = {
  member: {
    field: 'memberLimit',
    label: 'members',
    count: (subscriberId) => Member.countDocuments({ subscriberId, status: { $ne: 'cancelled' } }),
  },
  staff: {
    field: 'staffLimit',
    label: 'staff logins',
    count: (subscriberId) => SubAdmin.countDocuments({ subscriberId, isActive: { $ne: false } }),
  },
};

const planLimitGuard = (kind) => async (req, res, next) => {
  try {
    const rule = COUNTED[kind];
    const subscriber = await Subscriber.findById(req.user.subscriberId).select('platformPlanId');
    if (!subscriber?.platformPlanId) return next();

    const plan = await PlatformPlan.findById(subscriber.platformPlanId).select(`name ${rule.field}`);
    const limit = plan?.[rule.field];
    if (limit === undefined || limit === null) return next();

    const current = await rule.count(req.user.subscriberId);
    if (current >= limit) {
      return res.status(403).json({
        success: false,
        limitReached: true,
        limit,
        current,
        message: `Your ${plan.name} plan allows ${limit} ${rule.label}. Upgrade your plan to add more.`,
      });
    }
    next();
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

module.exports = { planLimitGuard };
