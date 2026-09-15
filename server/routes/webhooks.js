const express = require('express');
const router = express.Router();
const { handlePaymentWebhook } = require('../controllers/webhooks');

// No auth middleware — the gateway signature IS the authentication here.
router.post('/webhook', handlePaymentWebhook);

module.exports = router;
