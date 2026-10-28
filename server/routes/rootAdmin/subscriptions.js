const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../../middleware/auth');
const Subscriber = require('../../models/Subscriber');
const AuditLog = require('../../models/AuditLog');
const { buildOverview } = require('../../services/subscriptionOverview');
const { computeStatus, DAY } = require('../../services/subscription');

router.use(protect, authorize('root_admin'));

// GET /api/root-admin/subscriptions/overview
router.get('/overview', async (req, res) => {
  try {
    res.json({ success: true, data: await buildOverview() });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// POST /api/root-admin/subscriptions/:id/extend  { days, reason }
// Gives a gym extra days (trial or paid period) and records why.
router.post('/:id/extend', async (req, res) => {
  try {
    const days = Number(req.body.days);
    const reason = typeof req.body.reason === 'string' ? req.body.reason.trim() : '';
    if (!Number.isInteger(days) || days < 1 || days > 365) {
      return res.status(400).json({ success: false, message: 'days must be a whole number from 1 to 365' });
    }
    if (reason.length < 5) {
      return res.status(400).json({ success: false, message: 'Please give a reason (at least 5 characters)' });
    }
    const sub = await Subscriber.findById(req.params.id);
    if (!sub) return res.status(404).json({ success: false, message: 'Gym not found' });

    const now = new Date();
    const field = sub.paidUntil ? 'paidUntil' : 'trialEndsAt';
    const base = sub[field] && sub[field] > now ? sub[field] : now;
    const next = new Date(base.getTime() + days * DAY);
    sub[field] = next;
    await sub.save();

    await AuditLog.create({
      subscriberId: sub._id, actingRole: 'root_admin', actingUserId: req.user.id,
      module: 'subscription', action: `extend_${field}_${days}d: ${reason}`.slice(0, 300), targetId: sub._id,
    });
    res.json({ success: true, data: { field, newEnd: next, status: computeStatus(sub).status } });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
