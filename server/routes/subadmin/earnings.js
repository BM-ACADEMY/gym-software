const express = require('express');
const router = express.Router();
const { handleRequest } = require('../../controllers/admin/earnings');
const { protect, authorize } = require('../../middleware/auth');
const permissionGuard = require('../../middleware/permissionGuard');

router.get('/', protect, authorize('subadmin'), permissionGuard('earnings', 'view'), handleRequest);

module.exports = router;
