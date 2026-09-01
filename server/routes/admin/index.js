const express = require('express');
const router = express.Router();

router.use('/dashboard', require('./dashboard'));
router.use('/members', require('./members'));
router.use('/attendance', require('./attendance'));
router.use('/payment', require('./payment'));
router.use('/subadmins', require('./subadmins'));
router.use('/trainers', require('./trainers'));
router.use('/earnings', require('./earnings'));
router.use('/pt-sessions', require('./ptSessions'));
router.use('/workouts', require('./workouts'));
router.use('/ai-plans', require('./aiPlans'));
router.use('/accounts', require('./accounts'));
router.use('/trial', require('./trial'));
router.use('/payment-history', require('./paymentHistory'));
router.use('/plan-creation', require('./planCreation'));
router.use('/reports-analytics', require('./reportsAnalytics'));
router.use('/notifications', require('./notifications'));
router.use('/settings', require('./settings'));

module.exports = router;
