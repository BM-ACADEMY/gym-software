const express = require('express');
const router = express.Router();
const { listMyAttendance, selfCheckIn } = require('../../controllers/member/attendance');
const { protect, authorize } = require('../../middleware/auth');

router.use(protect, authorize('member'));

router.get('/', listMyAttendance);
router.post('/check-in', selfCheckIn);

module.exports = router;
