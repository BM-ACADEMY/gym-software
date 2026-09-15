const express = require('express');
const router = express.Router();
const { getDashboard } = require('../../controllers/rootAdmin/dashboard');
const { protect, authorize } = require('../../middleware/auth');

router.get('/', protect, authorize('root_admin'), getDashboard);

module.exports = router;
