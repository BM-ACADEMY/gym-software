const express = require('express');
const router = express.Router();
const { listLedger, exportLedger } = require('../../controllers/admin/paymentHistory');
const { protect, authorize } = require('../../middleware/auth');

router.use(protect, authorize('admin'));

router.get('/export', exportLedger);
router.get('/', listLedger);

module.exports = router;
