const express = require('express');
const router = express.Router();
const { listTemplates, createTemplate, updateTemplate, getMemberWorkout, assignMemberWorkout } = require('../../controllers/admin/workouts');
const { protect, authorize } = require('../../middleware/auth');
const permissionGuard = require('../../middleware/permissionGuard');

router.use(protect, authorize('subadmin'));

// Permission key is 'workout' (singular) — matches SUBADMIN_NAV, not the URL path.
router.get('/templates', permissionGuard('workout', 'view'), listTemplates);
router.post('/templates', permissionGuard('workout', 'edit'), createTemplate);
router.put('/templates/:id', permissionGuard('workout', 'edit'), updateTemplate);
router.get('/member/:memberId', permissionGuard('workout', 'view'), getMemberWorkout);
router.put('/member/:memberId', permissionGuard('workout', 'edit'), assignMemberWorkout);

module.exports = router;
