const express = require('express');
const router = express.Router();
const { getReports } = require('../../controllers/admin/reportsAnalytics');
const { protect, authorize } = require('../../middleware/auth');

router.get('/', protect, authorize('admin'), getReports);

module.exports = router;
