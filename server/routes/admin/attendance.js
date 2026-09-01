const express = require('express');
const router = express.Router();
const { checkIn, checkOut, listAttendance, todaySummary } = require('../../controllers/admin/attendance');
const { protect, authorize } = require('../../middleware/auth');

router.use(protect, authorize('admin'));

router.get('/today-summary', todaySummary);
router.get('/', listAttendance);
router.post('/', checkIn);
router.patch('/:id/check-out', checkOut);

module.exports = router;
