const express = require('express');
const router = express.Router();
const { getDashboard } = require('../../controllers/admin/dashboard');
const { protect, authorize } = require('../../middleware/auth');

router.get('/', protect, authorize('admin'), getDashboard);

module.exports = router;
