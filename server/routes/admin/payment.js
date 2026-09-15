const express = require('express');
const router = express.Router();
const { createPayment, addInstallment, refundPayment, listPayments, listOverdue, todaySummary, downloadInvoice } = require('../../controllers/admin/payment');
const { protect, authorize } = require('../../middleware/auth');

router.use(protect, authorize('admin'));

router.get('/today-summary', todaySummary);
router.get('/overdue', listOverdue);
router.get('/', listPayments);
router.post('/', createPayment);
router.get('/:id/invoice.pdf', downloadInvoice);
router.patch('/:id/installment', addInstallment);
router.patch('/:id/refund', refundPayment);

module.exports = router;
