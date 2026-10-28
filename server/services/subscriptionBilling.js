const crypto = require('crypto');
const Subscriber = require('../models/Subscriber');
const Member = require('../models/Member');
const SubAdmin = require('../models/SubAdmin');
const Counter = require('../models/Counter');
const SubscriptionPayment = require('../models/SubscriptionPayment');
const { getPlan } = require('../config/plans');
const { computeStatus } = require('./subscription');
const M = require('./billingMath');
const gateway = require('./paymentGateway');
const promoSvc = require('./promo');

const sellerState = () => process.env.SELLER_STATE || 'Puducherry';
const invoicePrefix = () => process.env.INVOICE_PREFIX || 'AV';

const fail = (status, message, code) => Object.assign(new Error(message), { status, code });

const usageOf = async (subscriberId) => {
  const [members, staff] = await Promise.all([
    Member.countDocuments({ subscriberId, status: { $ne: 'cancelled' } }),
    SubAdmin.countDocuments({ subscriberId, isActive: { $ne: false } }),
  ]);
  return { members, staff };
};

// What buying plan/cycle would cost this gym right now. No side effects.
const buildQuote = async (subscriberId, planKey, cycle, now = new Date(), promoCode) => {
  const plan = getPlan(planKey);
  if (!plan || !M.CYCLES[cycle]) throw fail(400, 'Choose a plan and monthly or yearly billing', 'bad_plan');

  const subscriber = await Subscriber.findById(subscriberId);
  if (!subscriber) throw fail(404, 'Gym not found');

  const status = computeStatus(subscriber, now);
  const rule = M.purchaseRule({
    status, currentPlan: subscriber.planKey, currentCycle: subscriber.billingCycle,
    paidUntil: subscriber.paidUntil, newPlan: planKey, now,
  });
  if (rule.blocked) throw fail(400, rule.blocked, rule.code);

  const usage = await usageOf(subscriberId);
  if (plan.memberLimit != null && usage.members > plan.memberLimit) {
    throw fail(402, `You have ${usage.members} members and ${plan.name} allows ${plan.memberLimit}. Choose a bigger plan.`, 'plan_limit');
  }
  if (plan.staffLimit != null && usage.staff > plan.staffLimit) {
    throw fail(402, `You have ${usage.staff} staff logins and ${plan.name} allows ${plan.staffLimit}. Choose a bigger plan.`, 'plan_limit');
  }

  if (!subscriber.state) {
    throw fail(400, 'Please select your state first. It decides how GST is shown on your invoice.', 'state_required');
  }
  const promo = promoCode ? await promoSvc.checkPromo(promoCode, { subscriberId, planKey, now }) : null;
  const quote = M.quote({ plan: planKey, cycle, creditRupees: rule.creditRupees, gstMode: M.gstModeFor(subscriber.state, sellerState()), discountPercent: promo ? promo.percentOff : 0 });
  return { subscriber, rule, quote, plan, promo };
};

const startCheckout = async (subscriberId, planKey, cycle, promoCode) => {
  const real = await gateway.isRealGatewayConfigured();
  if (!real && !gateway.simulationAllowed()) {
    throw fail(503, 'Online payment is not switched on yet. Please contact support.', 'billing_not_configured');
  }
  const { subscriber, rule, quote, promo } = await buildQuote(subscriberId, planKey, cycle, new Date(), promoCode);
  if (quote.total < 1) throw fail(400, 'This amount is too small to charge.');

  const receipt = `gd_${Date.now().toString(36)}`;
  let order;
  try {
    order = await gateway.createOrder({ amount: quote.total, receipt, notes: { subscriberId: String(subscriberId), plan: planKey, cycle } });
  } catch (err) {
    console.error('Razorpay order failed', err.response?.data || err.message);
    throw fail(502, 'The payment service did not respond. Please try again in a minute.', 'payment_gateway');
  }

  await SubscriptionPayment.create({
    subscriberId, planKey, cycle, startMode: rule.startMode, status: 'created',
    base: quote.base, credit: quote.credit, discount: quote.discount, promoCode: promo ? promo.code : undefined, taxable: quote.taxable, gst: quote.gst,
    cgst: quote.cgst, sgst: quote.sgst, igst: quote.igst, total: quote.total,
    gstMode: quote.gstMode, gstRate: quote.gstRate, provider: order.provider,
    razorpayOrderId: order.orderId, buyerName: subscriber.gymName,
    buyerGstin: subscriber.gstEnabled ? subscriber.gstNumber : undefined,
    buyerState: subscriber.state,
  });

  return { orderId: order.orderId, amount: quote.total, currency: 'INR', keyId: order.keyId || null, provider: order.provider, quote };
};

const nextInvoiceNo = async (now) => {
  const fy = M.fyOf(now);
  const c = await Counter.findOneAndUpdate({ _id: `invoice-${fy}` }, { $inc: { seq: 1 } }, { upsert: true, new: true });
  return M.invoiceNumber(invoicePrefix(), fy, c.seq);
};

// Move the gym onto what was paid for. Safe to run twice: paidUntil only moves forward.
// Applied exactly once per payment (appliedAt). It is unconditional because an
// upgrade with credit can legitimately end before the old paidUntil (e.g. yearly
// Starter to monthly Growth); the credit already paid for the unused days.
const applyToSubscriber = async (p) => {
  if (p.appliedAt) return;
  await Subscriber.updateOne(
    { _id: p.subscriberId },
    { $set: { planKey: p.planKey, billingCycle: p.cycle, paidUntil: p.periodEnd, nextBillingDate: p.periodEnd } }
  );
  await Subscriber.updateOne({ _id: p.subscriberId, planStartedAt: { $exists: false } }, { $set: { planStartedAt: p.paidAt } });
  await SubscriptionPayment.updateOne({ _id: p._id, appliedAt: { $exists: false } }, { $set: { appliedAt: new Date() } });
};

// Called by BOTH the browser confirmation and the Razorpay webhook. Idempotent:
// whichever arrives first does the work, the other is a no-op. paidAmountRupees
// (webhook only) must equal what we asked for, otherwise the order is failed.
const activate = async ({ orderId, paymentId, paidAmountRupees }, now = new Date()) => {
  const p0 = await SubscriptionPayment.findOne({ razorpayOrderId: orderId });
  if (!p0) return null;

  if (paidAmountRupees !== undefined && paidAmountRupees !== p0.total) {
    await SubscriptionPayment.updateOne({ _id: p0._id, status: 'created' }, { $set: { status: 'failed', note: `amount_mismatch:${paidAmountRupees}` } });
    return SubscriptionPayment.findById(p0._id);
  }

  const sub = await Subscriber.findById(p0.subscriberId).select('paidUntil');
  const start = p0.startMode === 'extend' && sub?.paidUntil && new Date(sub.paidUntil) > now ? new Date(sub.paidUntil) : now;

  const claimed = await SubscriptionPayment.findOneAndUpdate(
    { _id: p0._id, status: 'created' },
    { $set: { status: 'paid', razorpayPaymentId: paymentId, paidAt: now, periodStart: start, periodEnd: M.addPeriod(start, p0.cycle) } },
    { new: true }
  );
  let p = claimed || (await SubscriptionPayment.findById(p0._id));

  if (p.status === 'paid') {
    // Only the request that won the claim draws an invoice number. A later retry
    // repairs a run that crashed between the claim and numbering, once stale.
    const stale = !claimed && !p.invoiceNo && p.paidAt && now - p.paidAt > 60000;
    if ((claimed || stale) && !p.invoiceNo) {
      p = (await SubscriptionPayment.findOneAndUpdate({ _id: p._id, invoiceNo: { $exists: false } }, { $set: { invoiceNo: await nextInvoiceNo(now) } }, { new: true })) || (await SubscriptionPayment.findById(p._id));
    }
    await applyToSubscriber(p);
    await promoSvc.redeemForPayment(p);
  }
  return p;
};

// Browser confirmation after Razorpay Checkout: {order_id, payment_id, signature}.
const confirmCheckout = async (subscriberId, { orderId, paymentId, signature }) => {
  const p = await SubscriptionPayment.findOne({ subscriberId, razorpayOrderId: orderId });
  if (!p) throw fail(404, 'Order not found');
  const config = await gateway.getConfig();
  if (config.provider !== 'razorpay' || !config.keySecret) throw fail(400, 'Razorpay is not configured');
  const ok = gateway.verifyRazorpayCheckoutSignature({ orderId, paymentId, signature, keySecret: config.keySecret });
  if (!ok) throw fail(401, 'Invalid payment signature');
  return activate({ orderId, paymentId });
};

// Razorpay webhook: signature is HMAC-SHA256 of the RAW body with the webhook secret.
const webhookSecret = async () => {
  const config = await gateway.getConfig();
  return process.env.RAZORPAY_WEBHOOK_SECRET || config.webhookSecret || '';
};

const verifyWebhookSignature = (rawBody, signature, secret) => {
  if (!secret || !signature || !rawBody) return false;
  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  const a = Buffer.from(expected);
  const b = Buffer.from(String(signature));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
};

const handleWebhook = async (rawBody, signature) => {
  const secret = await webhookSecret();
  if (!verifyWebhookSignature(rawBody, signature, secret)) throw fail(401, 'Invalid webhook signature');
  const event = JSON.parse(rawBody.toString('utf8'));
  const payment = event?.payload?.payment?.entity;
  if (!payment) return { ignored: true };

  if (event.event === 'payment.captured' || event.event === 'order.paid') {
    const result = await activate({ orderId: payment.order_id, paymentId: payment.id, paidAmountRupees: payment.amount / 100 });
    return { handled: Boolean(result), status: result?.status };
  }
  if (event.event === 'payment.failed') {
    // One failed attempt must not kill the order: the customer can retry on the
    // same order and succeed. Only record the reason; the order stays 'created'.
    await SubscriptionPayment.updateOne({ razorpayOrderId: payment.order_id, status: 'created' }, { $set: { note: payment.error_description || 'payment_failed' } });
    return { handled: true, status: 'created' };
  }
  return { ignored: true };
};

module.exports = { buildQuote, startCheckout, activate, confirmCheckout, handleWebhook, verifyWebhookSignature, usageOf };
