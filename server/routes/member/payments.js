const express = require('express');
const router = express.Router();
const { listMyPayments, createCheckout, simulatePayment, verifyRazorpay, downloadInvoice } = require('../../controllers/member/payments');
const { protect, authorize } = require('../../middleware/auth');

router.use(protect, authorize('member'));

router.get('/', listMyPayments);
router.post('/:id/checkout', createCheckout);
router.post('/:id/simulate-payment', simulatePayment);
router.post('/:id/verify-razorpay', verifyRazorpay);
router.get('/:id/invoice.pdf', downloadInvoice);

module.exports = router;
