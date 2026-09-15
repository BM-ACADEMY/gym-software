const express = require('express');
const router = express.Router();
const { listMySessions, requestSession, cancelSession, rescheduleSession } = require('../../controllers/member/ptSessions');
const { protect, authorize } = require('../../middleware/auth');

router.use(protect, authorize('member'));

router.get('/', listMySessions);
router.post('/', requestSession);
router.patch('/:id/cancel', cancelSession);
router.put('/:id/reschedule', rescheduleSession);

module.exports = router;
