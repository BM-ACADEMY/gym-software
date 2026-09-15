const express = require('express');
const router = express.Router();
const { generatePlan, getMemberPlan, updatePlan, publishPlan } = require('../../controllers/admin/aiPlans');
const { protect, authorize } = require('../../middleware/auth');
const planFeatureGuard = require('../../middleware/planFeatureGuard');

router.use(protect, authorize('admin'), planFeatureGuard('ai-plans'));

router.post('/generate', generatePlan);
router.get('/member/:memberId', getMemberPlan);
router.put('/member/:memberId', updatePlan);
router.patch('/member/:memberId/publish', publishPlan);

module.exports = router;
