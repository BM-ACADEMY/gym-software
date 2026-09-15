const express = require('express');
const router = express.Router();
const { listNotifications, broadcast, runRulesNow } = require('../../controllers/admin/notifications');
const { protect, authorize } = require('../../middleware/auth');

router.use(protect, authorize('admin'));

router.get('/', listNotifications);
router.post('/broadcast', broadcast);
router.post('/run-rules', runRulesNow);

module.exports = router;
