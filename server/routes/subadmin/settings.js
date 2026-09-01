const express = require('express');
const router = express.Router();
const { handleRequest } = require('../../controllers/admin/settings');
const { protect, authorize } = require('../../middleware/auth');
const permissionGuard = require('../../middleware/permissionGuard');

router.get('/', protect, authorize('subadmin'), permissionGuard('settings', 'view'), handleRequest);

module.exports = router;
