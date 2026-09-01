const PlatformPlan = require('../../models/PlatformPlan');

// Keeps only well-formed feature entries and drops any referencing a feature
// id that no longer exists — the client always sends the full catalog shape,
// but this is cheap insurance against stale ids.
const sanitizeFeatures = (features) =>
  (features || [])
    .filter((f) => f && f.feature)
    .map((f) => ({
      feature: f.feature,
      enabled: f.enabled !== false,
      value: f.value === '' || f.value === undefined ? undefined : Number(f.value),
    }));

// @desc    List all platform plans (Starter/Growth/Pro/Trial, custom or archived)
// @route   GET /api/root-admin/plan-creation
const listPlans = async (req, res) => {
  try {
    const plans = await PlatformPlan.find().sort({ price: 1 }).populate('features.feature');
    res.status(200).json({ success: true, data: plans });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Create a platform plan
// @route   POST /api/root-admin/plan-creation
const createPlan = async (req, res) => {
  try {
    const { name, price, memberLimit, staffLimit, features, trialDays } = req.body;

    if (!name || price === undefined || price === '') {
      return res.status(400).json({ success: false, message: 'Name and price are required' });
    }

    const plan = await PlatformPlan.create({
      name,
      price,
      memberLimit: memberLimit === '' || memberLimit === undefined ? undefined : memberLimit,
      staffLimit: staffLimit === '' || staffLimit === undefined ? undefined : staffLimit,
      features: sanitizeFeatures(features),
      trialDays: trialDays || 0,
    });

    await plan.populate('features.feature');
    res.status(201).json({ success: true, data: plan });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Update a platform plan
// @route   PUT /api/root-admin/plan-creation/:id
const updatePlan = async (req, res) => {
  try {
    const { name, price, memberLimit, staffLimit, features, trialDays } = req.body;

    const plan = await PlatformPlan.findByIdAndUpdate(
      req.params.id,
      {
        ...(name !== undefined && { name }),
        ...(price !== undefined && { price }),
        memberLimit: memberLimit === '' ? undefined : memberLimit,
        staffLimit: staffLimit === '' ? undefined : staffLimit,
        ...(features !== undefined && { features: sanitizeFeatures(features) }),
        ...(trialDays !== undefined && { trialDays }),
      },
      { new: true, runValidators: true }
    ).populate('features.feature');

    if (!plan) {
      return res.status(404).json({ success: false, message: 'Plan not found' });
    }

    res.status(200).json({ success: true, data: plan });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Archive/restore a platform plan — never deleted outright, so
// existing subscribers already on it are unaffected.
// @route   PATCH /api/root-admin/plan-creation/:id/toggle
const togglePlan = async (req, res) => {
  try {
    const plan = await PlatformPlan.findById(req.params.id);
    if (!plan) {
      return res.status(404).json({ success: false, message: 'Plan not found' });
    }

    plan.isActive = !plan.isActive;
    await plan.save();

    res.status(200).json({ success: true, data: plan });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

module.exports = { listPlans, createPlan, updatePlan, togglePlan };
