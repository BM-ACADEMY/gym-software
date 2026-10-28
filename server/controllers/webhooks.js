const { processPaymentWebhook } = require('../services/webhookProcessor');
const { handleWebhook: handleSubscriptionWebhook } = require('../services/subscriptionBilling');

// @desc    Payment gateway webhook — authenticated by signature, not a JWT
//          (this is how real gateways call back: no user session exists).
// @route   POST /api/payments/webhook
const handlePaymentWebhook = async (req, res) => {
  try {
    const { signature, ...payload } = req.body;
    const result = await processPaymentWebhook(payload, signature);
    res.status(200).json({ success: true, message: result.duplicate ? 'Already processed' : 'Webhook processed', data: result });
  } catch (error) {
    console.error(error);
    res.status(error.status || 500).json({ success: false, message: error.status ? error.message : 'Server error' });
  }
};

// @desc    Razorpay webhook for GymDesk subscription payments. Authenticated by
//          the X-Razorpay-Signature header over the raw body.
// @route   POST /api/payments/razorpay-webhook
const handleRazorpayWebhook = async (req, res) => {
  try {
    const result = await handleSubscriptionWebhook(req.rawBody, req.headers['x-razorpay-signature']);
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    if (!error.status) console.error(error);
    res.status(error.status || 500).json({ success: false, message: error.status ? error.message : 'Server error' });
  }
};

module.exports = { handlePaymentWebhook, handleRazorpayWebhook };
