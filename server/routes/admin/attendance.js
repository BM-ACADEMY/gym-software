const express = require('express');
const router = express.Router();
const { checkIn, checkOut, listAttendance, todaySummary, scanCheckIn } = require('../../controllers/admin/attendance');
const { importDeviceLog } = require('../../controllers/admin/deviceLogImport');
const { protect, authorize } = require('../../middleware/auth');

router.use(protect, authorize('admin'));

router.get('/today-summary', todaySummary);
router.get('/', listAttendance);
router.post('/', checkIn);
router.post('/scan', scanCheckIn);
router.post('/device-log', importDeviceLog);
router.patch('/:id/check-out', checkOut);

module.exports = router;
