const express = require('express');
const router = express.Router();
const { handlePaymentWebhook, handleRazorpayWebhook } = require('../controllers/webhooks');

// No auth middleware — the gateway signature IS the authentication here.
router.post('/webhook', handlePaymentWebhook);
router.post('/razorpay-webhook', handleRazorpayWebhook);

module.exports = router;
