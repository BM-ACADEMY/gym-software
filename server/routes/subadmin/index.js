const express = require('express');
const router = express.Router();

router.use('/dashboard', require('./dashboard'));
router.use('/members', require('./members'));
router.use('/attendance', require('./attendance'));
router.use('/payment', require('./payment'));
router.use('/earnings', require('./earnings'));
router.use('/pt-sessions', require('./ptSessions'));
router.use('/workouts', require('./workouts'));
router.use('/ai-plans', require('./aiPlans'));
router.use('/payment-history', require('./paymentHistory'));
router.use('/settings', require('./settings'));

module.exports = router;
