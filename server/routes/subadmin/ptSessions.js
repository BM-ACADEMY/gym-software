const express = require('express');
const router = express.Router();
const { handleRequest } = require('../../controllers/admin/ptSessions');
const { protect, authorize } = require('../../middleware/auth');
const permissionGuard = require('../../middleware/permissionGuard');

router.get('/', protect, authorize('subadmin'), permissionGuard('pt-sessions', 'view'), handleRequest);

module.exports = router;
