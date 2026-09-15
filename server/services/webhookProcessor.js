const WebhookEvent = require('../models/WebhookEvent');
const Payment = require('../models/Payment');
const PlatformPayment = require('../models/PlatformPayment');
const Subscriber = require('../models/Subscriber');
const { verifySignature, verifyRazorpayCheckoutSignature, getConfig } = require('./paymentGateway');

// Shared by every verified-payment path (the dummy webhook, the dummy
// "simulate payment" endpoints, and the real Razorpay checkout verification
// below) — one place that actually marks a record paid/failed, so there's
// only one path to test regardless of which gateway produced the event.
const applyOutcome = async (orderId, status) => {
  let record = await Payment.findOne({ gatewayOrderId: orderId });
  let recordType = 'gym_payment';
  if (!record) {
    record = await PlatformPayment.findOne({ gatewayOrderId: orderId });
    recordType = 'platform_payment';
  }
  if (!record) {
    const err = new Error('No payment record found for this order');
    err.status = 404;
    throw err;
  }

  if (status === 'paid') {
    if (recordType === 'gym_payment') {
      const remaining = record.amount - record.amountPaid;
      if (remaining > 0) {
        record.installments.push({ amount: remaining, method: 'gateway', note: 'Paid via gateway webhook' });
        record.amountPaid += remaining;
        record.method = 'gateway';
      }
      record.status = record.amountPaid >= record.amount ? 'paid' : 'partial';
      record.paidAt = new Date();
      await record.save();
    } else {
      record.status = 'paid';
      record.paidAt = new Date();
      await record.save();
      await Subscriber.findByIdAndUpdate(record.subscriberId, {
        isActive: true,
        nextBillingDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        platformPlanId: record.planId,
      });
    }
  } else if (status === 'failed') {
    record.status = 'failed';
    await record.save();
  }

  return { duplicate: false, recordType, recordId: record._id, status: record.status };
};

const processPaymentWebhook = async (payload, signature) => {
  const valid = await verifySignature(payload, signature);
  if (!valid) {
    const err = new Error('Invalid webhook signature');
    err.status = 401;
    throw err;
  }

  // Idempotency: the unique (provider, eventId) index does the real work —
  // a retried delivery hits a duplicate-key error here and is treated as a
  // harmless no-op rather than double-applying the payment.
  try {
    await WebhookEvent.create({ provider: 'dummy', eventId: payload.eventId, payload });
  } catch (err) {
    if (err.code === 11000) return { duplicate: true };
    throw err;
  }

  return applyOutcome(payload.orderId, payload.status);
};

// Verifies a real Razorpay Checkout.js success callback and applies the same
// paid outcome. Idempotency reuses the same WebhookEvent ledger, keyed on
// Razorpay's own payment id — a duplicate verify call (e.g. a double-click,
// or the browser retrying) hits the same unique-index no-op as any other gateway.
const processRazorpayPayment = async ({ orderId, paymentId, signature }) => {
  const config = await getConfig();
  if (config.provider !== 'razorpay' || !config.keySecret) {
    const err = new Error('Razorpay is not configured');
    err.status = 400;
    throw err;
  }

  const valid = verifyRazorpayCheckoutSignature({ orderId, paymentId, signature, keySecret: config.keySecret });
  if (!valid) {
    const err = new Error('Invalid payment signature');
    err.status = 401;
    throw err;
  }

  try {
    await WebhookEvent.create({ provider: 'razorpay', eventId: paymentId, payload: { orderId, paymentId } });
  } catch (err) {
    if (err.code === 11000) return { duplicate: true };
    throw err;
  }

  return applyOutcome(orderId, 'paid');
};

module.exports = { processPaymentWebhook, processRazorpayPayment };
