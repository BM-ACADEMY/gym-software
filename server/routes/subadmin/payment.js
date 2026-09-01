const express = require('express');
const router = express.Router();
const { createPayment, addInstallment, refundPayment, listPayments, listOverdue, todaySummary } = require('../../controllers/admin/payment');
const { protect, authorize } = require('../../middleware/auth');
const permissionGuard = require('../../middleware/permissionGuard');

router.use(protect, authorize('subadmin'));

router.get('/today-summary', permissionGuard('payment', 'view'), todaySummary);
router.get('/overdue', permissionGuard('payment', 'view'), listOverdue);
router.get('/', permissionGuard('payment', 'view'), listPayments);
router.post('/', permissionGuard('payment', 'edit'), createPayment);
router.patch('/:id/installment', permissionGuard('payment', 'edit'), addInstallment);
router.patch('/:id/refund', permissionGuard('payment', 'edit'), refundPayment);

module.exports = router;
