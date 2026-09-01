const express = require('express');
const router = express.Router();
const { handleRequest } = require('../../controllers/admin/reportsAnalytics');
const { protect, authorize } = require('../../middleware/auth');

router.get('/', protect, authorize('admin'), handleRequest);

module.exports = router;
