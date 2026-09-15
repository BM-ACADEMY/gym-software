const express = require('express');
const router = express.Router();
const { getMyWorkout, markDone, logProgress } = require('../../controllers/member/workoutDietPlan');
const { protect, authorize } = require('../../middleware/auth');

router.use(protect, authorize('member'));

router.get('/', getMyWorkout);
router.post('/mark-done', markDone);
router.post('/progress', logProgress);

module.exports = router;
