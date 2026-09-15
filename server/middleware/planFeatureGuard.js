const Subscriber = require('../models/Subscriber');
const PlatformPlan = require('../models/PlatformPlan');

// Doc NFR: "Feature gating is enforced server-side via a middleware that
// checks the subscriber's active planId + feature flags... never gated only
// in the frontend." Attaches req.planFeature = { feature, enabled, value }
// (value = monthly quota for a 'count'-type feature, undefined = unlimited)
// so the route handler can enforce quota without re-querying the plan.
const planFeatureGuard = (featureKey) => async (req, res, next) => {
  try {
    const subscriber = await Subscriber.findById(req.user.subscriberId);
    if (!subscriber?.platformPlanId) {
      return res.status(403).json({ success: false, message: 'Your gym has no platform plan assigned — contact GymDesk support.' });
    }

    const plan = await PlatformPlan.findById(subscriber.platformPlanId).populate('features.feature');
    const entry = plan?.features?.find((f) => f.feature?.key === featureKey && f.enabled);
    if (!entry) {
      return res.status(403).json({ success: false, message: `Your plan (${plan?.name || 'current plan'}) doesn't include this feature.` });
    }

    req.planFeature = entry;
    next();
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

module.exports = planFeatureGuard;
