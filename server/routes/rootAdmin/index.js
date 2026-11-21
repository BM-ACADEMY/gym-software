const express = require('express');
const router = express.Router();

router.use('/dashboard', require('./dashboard'));
router.use('/subscribers', require('./subscribers'));
router.use('/plan-creation', require('./planCreation'));
router.use('/plan-features', require('./planFeatures'));
router.use('/plan-settings', require('./planSettings'));
router.use('/site-content', require('./siteContent'));
router.use('/coupons', require('./coupons'));
router.use('/promo-codes', require('./promoCodes'));
router.use('/analytics', require('./analytics'));
router.use('/subscriptions', require('./subscriptions'));
router.use('/billing', require('./billing'));
router.use('/support', require('./support'));
router.use('/request-access', require('./requestAccess'));
router.use('/settings', require('./settings'));
router.use('/usage', require('./usage'));
router.use('/products', require('./products'));

module.exports = router;
