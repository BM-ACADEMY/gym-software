const express = require('express');
const router = express.Router();
const { listLedger, exportLedger } = require('../../controllers/admin/paymentHistory');
const { protect, authorize } = require('../../middleware/auth');
const permissionGuard = require('../../middleware/permissionGuard');

router.use(protect, authorize('subadmin'));

router.get('/export', permissionGuard('payment-history', 'view'), exportLedger);
router.get('/', permissionGuard('payment-history', 'view'), listLedger);

module.exports = router;
