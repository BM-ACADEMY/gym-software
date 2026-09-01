const express = require('express');
const router = express.Router();
const { handleRequest } = require('../../controllers/admin/workouts');
const { protect, authorize } = require('../../middleware/auth');
const permissionGuard = require('../../middleware/permissionGuard');

router.get('/', protect, authorize('subadmin'), permissionGuard('workout', 'view'), handleRequest);

module.exports = router;
