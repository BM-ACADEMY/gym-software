const Member = require('../../models/Member');
const GymPlan = require('../../models/GymPlan');

// @desc    View own plan status + the gym's available plans (for renew/upgrade)
// @route   GET /api/member/subscription-plan
const getSubscription = async (req, res) => {
  try {
    const member = await Member.findById(req.user.id).populate('planId');
    if (!member) {
      return res.status(404).json({ success: false, message: 'Member not found' });
    }

    const availablePlans = await GymPlan.find({ subscriberId: req.user.subscriberId, isActive: true }).sort({ price: 1 });

    res.status(200).json({
      success: true,
      data: {
        status: member.status,
        expiresAt: member.expiresAt,
        plan: member.planId,
        freezeHistory: member.freezeHistory,
        availablePlans,
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Renew the current plan, or switch to a new one (upgrade/downgrade/trial-to-paid)
// @route   POST /api/member/subscription-plan/renew
const renewSubscription = async (req, res) => {
  try {
    const { planId } = req.body;

    const member = await Member.findById(req.user.id);
    if (!member) {
      return res.status(404).json({ success: false, message: 'Member not found' });
    }

    const targetPlanId = planId || member.planId;
    if (!targetPlanId) {
      return res.status(400).json({ success: false, message: 'No plan selected' });
    }

    const plan = await GymPlan.findOne({ _id: targetPlanId, subscriberId: req.user.subscriberId, isActive: true });
    if (!plan) {
      return res.status(404).json({ success: false, message: 'Plan not found' });
    }

    const now = new Date();
    const base = member.expiresAt && member.expiresAt > now ? member.expiresAt : now;
    member.planId = plan._id;
    member.expiresAt = new Date(base.getTime() + plan.durationDays * 24 * 60 * 60 * 1000);
    member.status = 'active';
    await member.save();

    const updated = await Member.findById(member._id).populate('planId');
    res.status(200).json({
      success: true,
      message: `Renewed on "${plan.name}" until ${updated.expiresAt.toDateString()}`,
      data: { status: updated.status, expiresAt: updated.expiresAt, plan: updated.planId },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Request a freeze on the current plan (medical leave, travel, etc.)
// @route   POST /api/member/subscription-plan/freeze
const freezeSubscription = async (req, res) => {
  try {
    const { days, reason } = req.body;

    const member = await Member.findById(req.user.id).populate('planId');
    if (!member) {
      return res.status(404).json({ success: false, message: 'Member not found' });
    }

    if (!member.planId || !member.planId.allowFreeze) {
      return res.status(400).json({ success: false, message: 'Your plan does not allow freezing' });
    }

    const freezeDays = Number(days) || 0;
    if (freezeDays <= 0 || freezeDays > member.planId.maxFreezeDays) {
      return res.status(400).json({
        success: false,
        message: `Freeze must be between 1 and ${member.planId.maxFreezeDays} days`,
      });
    }

    const startedAt = new Date();
    const endsAt = new Date(startedAt.getTime() + freezeDays * 24 * 60 * 60 * 1000);

    member.freezeHistory.push({ startedAt, endsAt, reason });
    member.status = 'frozen';
    await member.save();

    res.status(200).json({ success: true, message: `Plan frozen until ${endsAt.toDateString()}`, data: { status: member.status, freezeHistory: member.freezeHistory } });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    End an active freeze early
// @route   POST /api/member/subscription-plan/unfreeze
const unfreezeSubscription = async (req, res) => {
  try {
    const member = await Member.findById(req.user.id);
    if (!member) {
      return res.status(404).json({ success: false, message: 'Member not found' });
    }

    member.status = 'active';
    await member.save();

    res.status(200).json({ success: true, message: 'Plan unfrozen', data: { status: member.status } });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

module.exports = { getSubscription, renewSubscription, freezeSubscription, unfreezeSubscription };
