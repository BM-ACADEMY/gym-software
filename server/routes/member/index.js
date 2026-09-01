const express = require('express');
const router = express.Router();

router.use('/dashboard', require('./dashboard'));
router.use('/attendance', require('./attendance'));
router.use('/subscription-plan', require('./subscriptionPlan'));
router.use('/payments', require('./payments'));
router.use('/pt-sessions', require('./ptSessions'));
router.use('/workout-diet-plan', require('./workoutDietPlan'));
router.use('/notifications', require('./notifications'));
router.use('/settings', require('./settings'));

module.exports = router;
