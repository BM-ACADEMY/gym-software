const Subscriber = require('../models/Subscriber');
const PlatformPlan = require('../models/PlatformPlan');
const { effectivePlan } = require('../services/subscription');

// Doc NFR: "Feature gating is enforced server-side via a middleware that
// checks the subscriber's active planId + feature flags... never gated only
// in the frontend." Attaches req.planFeature = { feature, enabled, value }
// (value = monthly quota for a 'count'-type feature, undefined = unlimited)
// so the route handler can enforce quota without re-querying the plan.
const planFeatureGuard = (featureKey) => async (req, res, next) => {
  try {
    const subscriber = await Subscriber.findById(req.user.subscriberId);

    // New gyms: code-defined plan (config/plans.js), trial counts as Growth.
    const codePlan = subscriber && !subscriber.platformPlanId ? effectivePlan(subscriber) : null;
    if (codePlan) {
      if (!codePlan.features[featureKey]) {
        return res.status(403).json({ success: false, message: `Your plan (${codePlan.name}) doesn't include this feature. Upgrade to use it.` });
      }
      req.planFeature = { feature: { key: featureKey }, enabled: true, value: undefined };
      return next();
    }

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

// For features that exist only in the code-defined plans (config/plans.js).
// Gyms on the legacy DB plan system, or with no plan assigned (old pilot gyms),
// pass through untouched so nothing that works today breaks.
const codeFeatureGuard = (featureKey) => async (req, res, next) => {
  try {
    const subscriber = await Subscriber.findById(req.user.subscriberId);
    if (!subscriber || subscriber.platformPlanId) return next();
    const plan = effectivePlan(subscriber);
    if (!plan) return next();
    if (!plan.features[featureKey]) {
      return res.status(403).json({
        success: false,
        planUpgradeRequired: true,
        message: `Your plan (${plan.name}) doesn't include this feature. Upgrade to use it.`,
      });
    }
    next();
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

module.exports = planFeatureGuard;
module.exports.codeFeatureGuard = codeFeatureGuard;
