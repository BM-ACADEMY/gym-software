const express = require('express');
const router = express.Router();
const { getSettings, updateProfile, updateBranding, updateNotificationTemplates, updatePaymentGateway, getTestCharge, setTestCharge, clearTestCharge } = require('../../controllers/rootAdmin/settings');
const { protect, authorize } = require('../../middleware/auth');

router.use(protect, authorize('root_admin'));

router.get('/', getSettings);
router.put('/profile', updateProfile);
router.put('/branding', updateBranding);
router.put('/notification-templates', updateNotificationTemplates);
router.put('/payment-gateway', updatePaymentGateway);
router.get('/test-charge', getTestCharge);
router.put('/test-charge', setTestCharge);
router.delete('/test-charge', clearTestCharge);

module.exports = router;
