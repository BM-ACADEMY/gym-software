const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../../middleware/auth');
const Subscriber = require('../../models/Subscriber');
const coach = require('../../services/ownerCoach');

router.use(protect, authorize('admin'));

// GET /api/admin/coach : this week's 3 actions with rupees at stake and whether the owner has started them
router.get('/', async (req, res) => {
  try {
    const sub = await Subscriber.findById(req.user.subscriberId);
    if (!sub) return res.status(404).json({ success: false, message: 'Gym not found' });
    res.set('Cache-Control', 'no-store');
    res.json({ success: true, data: await coach.getCoach(sub) });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});
module.exports = router;
