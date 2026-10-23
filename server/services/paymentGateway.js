const crypto = require('crypto');
const axios = require('axios');
const SystemSettings = require('../models/SystemSettings');

// A dummy payment gateway with the exact shape a real one (Razorpay/Stripe)
// would have — create an order, sign a webhook payload, verify a signature.
// When Root Admin has configured real Razorpay credentials (Settings →
// Payment gateway), createOrder and the checkout-verification flow below
// call the real Razorpay API instead — see getConfig().
//
// The signing secret comes from Root Admin Settings' payment gateway config
// (Task 21) if one has been entered there; otherwise falls back to a fixed
// dev-only secret so the dummy flow still works end-to-end without setup.
const DUMMY_SECRET = 'dummy-gateway-dev-secret-not-for-production';

const getConfig = async () => SystemSettings.getSetting('payment_gateway', { provider: '', keyId: '', keySecret: '' });

// In production there is NO fallback secret: if Root Admin has not saved a
// real gateway secret, signing and verifying both fail closed. (A fixed,
// publicly known secret would let anyone forge a "payment received" webhook.)
const getSecret = async () => {
  const config = await getConfig();
  if (config.keySecret) return config.keySecret;
  if (process.env.NODE_ENV === 'production') {
    const err = new Error('Payment gateway is not configured');
    err.status = 503;
    throw err;
  }
  return DUMMY_SECRET;
};

// The "simulate payment" shortcuts only exist for local development and the
// test suite. They are never available in production, whatever gateway is set.
const simulationAllowed = () => process.env.NODE_ENV !== 'production';

// True when no real gateway is configured (orders would be dummy ones that
// nobody can pay).
const isRealGatewayConfigured = async () => {
  const config = await getConfig();
  return config.provider === 'razorpay' && Boolean(config.keyId && config.keySecret);
};

const signPayload = (payload, secret) =>
  crypto.createHmac('sha256', secret).update(JSON.stringify(payload)).digest('hex');

// @param amount is in whole rupees, matching how the rest of this codebase
// stores amounts — Razorpay's API wants paise, so it's converted right before
// the real API call and never elsewhere.
const createOrder = async ({ amount, receipt, notes }) => {
  const config = await getConfig();

  if (config.provider === 'razorpay' && config.keyId && config.keySecret) {
    const { data } = await axios.post(
      'https://api.razorpay.com/v1/orders',
      { amount: Math.round(amount * 100), currency: 'INR', receipt, notes },
      { auth: { username: config.keyId, password: config.keySecret } }
    );
    return { orderId: data.id, amount, currency: data.currency, receipt, notes, status: data.status, provider: 'razorpay', keyId: config.keyId };
  }

  const orderId = `order_dummy_${crypto.randomBytes(10).toString('hex')}`;
  return { orderId, amount, currency: 'INR', receipt, notes, status: 'created', provider: 'dummy' };
};

// Builds a correctly-signed webhook payload — used by the dummy "simulate
// payment" endpoints to exercise the exact same verification/idempotency path
// a real gateway's webhook delivery would hit, without a real gateway existing.
const buildSimulatedWebhook = async ({ orderId, status = 'paid', amount, notes }) => {
  const secret = await getSecret();
  const eventId = `evt_dummy_${crypto.randomBytes(10).toString('hex')}`;
  const payload = { eventId, orderId, status, amount, notes, occurredAt: new Date().toISOString() };
  const signature = signPayload(payload, secret);
  return { payload, signature };
};

const verifySignature = async (payload, signature) => {
  const secret = await getSecret();
  const expected = signPayload(payload, secret);
  // Constant-time comparison — the standard, correct way to compare a
  // provided signature against the expected one.
  const a = Buffer.from(expected);
  const b = Buffer.from(signature || '');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
};

// Real Razorpay checkout verification: after Checkout.js completes a payment
// in the browser, it hands back {order_id, payment_id, signature}. Razorpay's
// documented scheme signs "order_id|payment_id" with the account's key_secret
// — this is the standard client-redirect verification, distinct from (and not
// requiring) a server-to-server webhook with a publicly reachable URL.
const verifyRazorpayCheckoutSignature = ({ orderId, paymentId, signature, keySecret }) => {
  const expected = crypto.createHmac('sha256', keySecret).update(`${orderId}|${paymentId}`).digest('hex');
  const a = Buffer.from(expected);
  const b = Buffer.from(signature || '');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
};

module.exports = { getConfig, simulationAllowed, isRealGatewayConfigured, createOrder, buildSimulatedWebhook, verifySignature, verifyRazorpayCheckoutSignature };
