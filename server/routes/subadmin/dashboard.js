const express = require('express');
const router = express.Router();
const { getDashboard } = require('../../controllers/admin/dashboard');
const { protect, authorize } = require('../../middleware/auth');
const permissionGuard = require('../../middleware/permissionGuard');

router.get('/', protect, authorize('subadmin'), permissionGuard('dashboard', 'view'), getDashboard);

module.exports = router;
