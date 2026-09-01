const express = require('express');
const router = express.Router();
const { handleRequest } = require('../../controllers/admin/aiPlans');
const { protect, authorize } = require('../../middleware/auth');
const permissionGuard = require('../../middleware/permissionGuard');

router.get('/', protect, authorize('subadmin'), permissionGuard('ai-plans', 'view'), handleRequest);

module.exports = router;
