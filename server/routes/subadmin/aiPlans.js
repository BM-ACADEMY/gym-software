const express = require('express');
const router = express.Router();
const { generatePlan, getMemberPlan, updatePlan } = require('../../controllers/admin/aiPlans');
const { protect, authorize } = require('../../middleware/auth');
const permissionGuard = require('../../middleware/permissionGuard');
const planFeatureGuard = require('../../middleware/planFeatureGuard');

router.use(protect, authorize('subadmin'), planFeatureGuard('ai-plans'));

router.post('/generate', permissionGuard('ai-plans', 'edit'), generatePlan);
router.get('/member/:memberId', permissionGuard('ai-plans', 'view'), getMemberPlan);
router.put('/member/:memberId', permissionGuard('ai-plans', 'edit'), updatePlan);
// No publish route here — publishing is Gym-Owner-only, per the doc.

module.exports = router;
