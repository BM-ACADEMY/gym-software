const express = require('express');
const router = express.Router();
const { listMyInvoices, createCheckout, simulatePayment, verifyRazorpay } = require('../../controllers/admin/billing');
const { protect, authorize } = require('../../middleware/auth');

router.use(protect, authorize('admin'));

router.get('/invoices', listMyInvoices);
router.post('/invoices/:id/checkout', createCheckout);
router.post('/invoices/:id/simulate-payment', simulatePayment);
router.post('/invoices/:id/verify-razorpay', verifyRazorpay);

module.exports = router;
