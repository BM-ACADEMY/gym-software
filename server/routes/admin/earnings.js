const express = require('express');
const router = express.Router();
const { getEarnings } = require('../../controllers/admin/earnings');
const { protect, authorize } = require('../../middleware/auth');

router.get('/', protect, authorize('admin'), getEarnings);

module.exports = router;
