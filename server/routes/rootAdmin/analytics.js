const express = require('express');
const router = express.Router();
const { getAnalytics, exportAnalytics, exportAnalyticsPdf } = require('../../controllers/rootAdmin/analytics');
const { protect, authorize } = require('../../middleware/auth');

router.use(protect, authorize('root_admin'));

router.get('/export', exportAnalytics);
router.get('/export.pdf', exportAnalyticsPdf);
router.get('/', getAnalytics);

module.exports = router;
