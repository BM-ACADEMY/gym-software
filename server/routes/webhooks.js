const express = require('express');
const router = express.Router();
const { handlePaymentWebhook, handleRazorpayWebhook, verifyWhatsappWebhook, handleWhatsappWebhook } = require('../controllers/webhooks');

// No auth middleware — the gateway signature IS the authentication here.
router.post('/webhook', handlePaymentWebhook);
router.post('/razorpay-webhook', handleRazorpayWebhook);
router.get('/whatsapp-webhook', verifyWhatsappWebhook);
router.post('/whatsapp-webhook', handleWhatsappWebhook);

module.exports = router;
