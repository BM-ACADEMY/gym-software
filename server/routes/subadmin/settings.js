const express = require('express');
const router = express.Router();
const { getMyProfile, updateMyProfile } = require('../../controllers/admin/settings');
const { protect, authorize } = require('../../middleware/auth');
const permissionGuard = require('../../middleware/permissionGuard');

router.use(protect, authorize('subadmin'));

router.get('/', permissionGuard('settings', 'view'), getMyProfile);
router.put('/profile', permissionGuard('settings', 'edit'), updateMyProfile);

module.exports = router;
