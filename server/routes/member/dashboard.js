const express = require('express');
const router = express.Router();
const { getDashboard } = require('../../controllers/member/dashboard');
const { protect, authorize } = require('../../middleware/auth');

router.get('/', protect, authorize('member'), getDashboard);

module.exports = router;
