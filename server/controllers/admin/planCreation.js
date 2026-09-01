const GymPlan = require('../../models/GymPlan');

// @desc    List this gym's own membership plans (Monthly/Quarterly/Annual/PT Add-on)
// @route   GET /api/admin/plan-creation
const listPlans = async (req, res) => {
  try {
    const plans = await GymPlan.find({ subscriberId: req.user.subscriberId }).sort({ price: 1 });
    res.status(200).json({ success: true, data: plans });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Create a gym membership plan
// @route   POST /api/admin/plan-creation
const createPlan = async (req, res) => {
  try {
    const { name, durationDays, price, includedServices, trialEligible, autoRenew, allowFreeze, maxFreezeDays } = req.body;

    if (!name || !durationDays || price === undefined || price === '') {
      return res.status(400).json({ success: false, message: 'Name, duration and price are required' });
    }

    const plan = await GymPlan.create({
      subscriberId: req.user.subscriberId,
      name,
      durationDays,
      price,
      includedServices: includedServices || [],
      trialEligible: Boolean(trialEligible),
      autoRenew: Boolean(autoRenew),
      allowFreeze: Boolean(allowFreeze),
      maxFreezeDays: maxFreezeDays || 0,
    });

    res.status(201).json({ success: true, data: plan });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Update a gym membership plan
// @route   PUT /api/admin/plan-creation/:id
const updatePlan = async (req, res) => {
  try {
    const { name, durationDays, price, includedServices, trialEligible, autoRenew, allowFreeze, maxFreezeDays } = req.body;

    const plan = await GymPlan.findOneAndUpdate(
      { _id: req.params.id, subscriberId: req.user.subscriberId },
      {
        ...(name !== undefined && { name }),
        ...(durationDays !== undefined && { durationDays }),
        ...(price !== undefined && { price }),
        ...(includedServices !== undefined && { includedServices }),
        ...(trialEligible !== undefined && { trialEligible: Boolean(trialEligible) }),
        ...(autoRenew !== undefined && { autoRenew: Boolean(autoRenew) }),
        ...(allowFreeze !== undefined && { allowFreeze: Boolean(allowFreeze) }),
        ...(maxFreezeDays !== undefined && { maxFreezeDays }),
      },
      { returnDocument: 'after', runValidators: true }
    );

    if (!plan) {
      return res.status(404).json({ success: false, message: 'Plan not found' });
    }

    res.status(200).json({ success: true, data: plan });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Activate/deactivate a gym plan — members already on it are unaffected.
// @route   PATCH /api/admin/plan-creation/:id/toggle
const togglePlan = async (req, res) => {
  try {
    const plan = await GymPlan.findOne({ _id: req.params.id, subscriberId: req.user.subscriberId });
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
