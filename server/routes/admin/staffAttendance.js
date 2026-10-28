const express = require('express');
const router = express.Router();
const { listDay, monthSummary, mark } = require('../../controllers/admin/staffAttendance');
const { protect, authorize } = require('../../middleware/auth');

router.use(protect, authorize('admin'));

router.get('/', listDay);
router.get('/month', monthSummary);
router.put('/', mark);

module.exports = router;
