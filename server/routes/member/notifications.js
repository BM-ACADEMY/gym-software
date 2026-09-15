const express = require('express');
const router = express.Router();
const { listMyNotifications, markRead } = require('../../controllers/member/notifications');
const { protect, authorize } = require('../../middleware/auth');

router.use(protect, authorize('member'));

router.get('/', listMyNotifications);
router.patch('/:id/read', markRead);

module.exports = router;
