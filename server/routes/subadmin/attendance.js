const express = require('express');
const router = express.Router();
const { checkIn, checkOut, listAttendance, todaySummary, scanCheckIn } = require('../../controllers/admin/attendance');
const { protect, authorize } = require('../../middleware/auth');
const permissionGuard = require('../../middleware/permissionGuard');

router.use(protect, authorize('subadmin'));

router.get('/today-summary', permissionGuard('attendance', 'view'), todaySummary);
router.get('/', permissionGuard('attendance', 'view'), listAttendance);
router.post('/', permissionGuard('attendance', 'edit'), checkIn);
router.post('/scan', permissionGuard('attendance', 'edit'), scanCheckIn);
router.patch('/:id/check-out', permissionGuard('attendance', 'edit'), checkOut);

module.exports = router;
