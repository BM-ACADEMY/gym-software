const { processPaymentWebhook } = require('../services/webhookProcessor');
const { handleWebhook: handleSubscriptionWebhook } = require('../services/subscriptionBilling');
const { verifyMetaSignature } = require('../utils/whatsapp');
const { extractMessages, handleInbound } = require('../services/supportBot');

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

// @desc    WhatsApp (Meta) webhook verification handshake.
// @route   GET /api/payments/whatsapp-webhook
const verifyWhatsappWebhook = (req, res) => {
  const token = process.env.WHATSAPP_VERIFY_TOKEN;
  if (token && req.query['hub.mode'] === 'subscribe' && req.query['hub.verify_token'] === token) {
    return res.status(200).send(String(req.query['hub.challenge'] || ''));
  }
  res.sendStatus(403);
};

// @desc    Inbound WhatsApp messages to the GymDesk support number (gym owners writing in).
//          Authenticated by Meta's X-Hub-Signature-256 over the raw body.
// @route   POST /api/payments/whatsapp-webhook
const handleWhatsappWebhook = async (req, res) => {
  if (!verifyMetaSignature(req.rawBody, req.headers['x-hub-signature-256'], process.env.WHATSAPP_APP_SECRET)) {
    return res.sendStatus(401);
  }
  res.sendStatus(200); // answer Meta at once; replies are sent after
  for (const msg of extractMessages(req.body)) {
    await handleInbound(msg);
  }
};

module.exports = { handlePaymentWebhook, handleRazorpayWebhook, verifyWhatsappWebhook, handleWhatsappWebhook };
