const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../../middleware/auth');
const Subscriber = require('../../models/Subscriber');
const Member = require('../../models/Member');
const SubAdmin = require('../../models/SubAdmin');
const { computeStatus, effectivePlan } = require('../../services/subscription');
const { listPlans, priceFor, GST_RATE, GRACE_DAYS } = require('../../config/plans');

// GET /api/admin/subscription: what the owner sees on the Billing page and
// in the trial/expiry banner. Always readable, even when the gym is locked.
router.get('/', protect, authorize('admin'), async (req, res) => {
  try {
    const subscriber = await Subscriber.findById(req.user.subscriberId);
    if (!subscriber) return res.status(404).json({ success: false, message: 'Gym not found' });

    const status = computeStatus(subscriber);
    const plan = effectivePlan(subscriber);
    const [members, staff] = await Promise.all([
      Member.countDocuments({ subscriberId: subscriber._id, status: { $ne: 'cancelled' } }),
      SubAdmin.countDocuments({ subscriberId: subscriber._id, isActive: { $ne: false } }),
    ]);

    res.json({
      success: true,
      data: {
        status: status.status,
        readOnly: status.readOnly,
        endsAt: status.endsAt || null,
        daysLeft: status.daysLeft ?? null,
        graceDays: GRACE_DAYS,
        currentPlan: plan ? { key: plan.key, name: plan.name, memberLimit: plan.memberLimit, staffLimit: plan.staffLimit, features: plan.features } : null,
        billingCycle: subscriber.billingCycle || null,
        usage: { members, staff },
        gstRate: GST_RATE,
        plans: listPlans().map((p) => ({
          key: p.key, name: p.name, memberLimit: p.memberLimit, staffLimit: p.staffLimit, features: p.features,
          monthly: priceFor(p.key, 'monthly'), yearly: priceFor(p.key, 'yearly'),
        })),
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
