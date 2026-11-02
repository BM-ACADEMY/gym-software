const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../../middleware/auth');
const Subscriber = require('../../models/Subscriber');
const GymPlan = require('../../models/GymPlan');
const aiAssist = require('../../services/aiAssist');
const coachRules = require('../../services/ownerCoachRules');
const R = require('../../services/marketingIdeasRules');

router.use(protect, authorize('admin'));

// GET /api/admin/marketing-ideas : up to 3 drafts the owner may copy. Nothing is sent from here.
router.get('/', async (req, res) => {
  try {
    const sub = await Subscriber.findById(req.user.subscriberId);
    if (!sub) return res.status(404).json({ success: false, message: 'Gym not found' });
    const [stats, plans] = await Promise.all([aiAssist.gatherStats(sub._id), GymPlan.find({ subscriberId: sub._id }).select('price durationDays').limit(50).lean()]);
    res.set('Cache-Control', 'no-store');
    res.json({ success: true, data: { ideas: R.buildIdeas(stats, coachRules.monthlyFee(plans)) } });
  } catch (error) { console.error(error); res.status(500).json({ success: false, message: 'Server error' }); }
});
module.exports = router;
