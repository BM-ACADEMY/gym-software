const express = require('express');
const router = express.Router();

router.use('/dashboard', require('./dashboard'));
router.use('/subscribers', require('./subscribers'));
router.use('/plan-creation', require('./planCreation'));
router.use('/plan-features', require('./planFeatures'));
router.use('/coupons', require('./coupons'));
router.use('/analytics', require('./analytics'));
router.use('/billing', require('./billing'));
router.use('/support', require('./support'));
router.use('/request-access', require('./requestAccess'));
router.use('/settings', require('./settings'));

module.exports = router;
