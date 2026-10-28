const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../../middleware/auth');
const Subscriber = require('../../models/Subscriber');
const Member = require('../../models/Member');
const SubAdmin = require('../../models/SubAdmin');
const { computeStatus, effectivePlan } = require('../../services/subscription');
const { listPlans, priceFor, GST_RATE, GRACE_DAYS } = require('../../config/plans');

// GET /api/admin/subscription: what the owner sees on the Billing page and
// in the trial/expiry banner. Always readable, even when the gym is locked.
router.get('/', protect, authorize('admin'), async (req, res) => {
  try {
    const subscriber = await Subscriber.findById(req.user.subscriberId);
    if (!subscriber) return res.status(404).json({ success: false, message: 'Gym not found' });

    const status = computeStatus(subscriber);
    const plan = effectivePlan(subscriber);
    const [members, staff] = await Promise.all([
      Member.countDocuments({ subscriberId: subscriber._id, status: { $ne: 'cancelled' } }),
      SubAdmin.countDocuments({ subscriberId: subscriber._id, isActive: { $ne: false } }),
    ]);

    res.json({
      success: true,
      data: {
        status: status.status,
        readOnly: status.readOnly,
        endsAt: status.endsAt || null,
        daysLeft: status.daysLeft ?? null,
        graceDays: GRACE_DAYS,
        currentPlan: plan ? { key: plan.key, name: plan.name, memberLimit: plan.memberLimit, staffLimit: plan.staffLimit, features: plan.features } : null,
        billingCycle: subscriber.billingCycle || null,
        state: subscriber.state || null,
        gstNumber: subscriber.gstNumber || null,
        sellerState: process.env.SELLER_STATE || 'Puducherry',
        usage: { members, staff },
        gstRate: GST_RATE,
        plans: listPlans().map((p) => ({
          key: p.key, name: p.name, memberLimit: p.memberLimit, staffLimit: p.staffLimit, features: p.features, whatsappPerMonth: p.whatsappPerMonth, aiCallsPerMonth: p.aiCallsPerMonth,
          monthly: priceFor(p.key, 'monthly'), yearly: priceFor(p.key, 'yearly'),
        })),
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

const billing = require('../../services/subscriptionBilling');
const SubscriptionPayment = require('../../models/SubscriptionPayment');
const gateway = require('../../services/paymentGateway');
const { streamSubscriptionInvoice } = require('../../utils/subscriptionInvoicePdf');

const handle = (fn) => async (req, res) => {
  try {
    await fn(req, res);
  } catch (error) {
    if (!error.status) console.error(error);
    res.status(error.status || 500).json({ success: false, code: error.code, message: error.status ? error.message : 'Server error' });
  }
};

const str = (v) => (typeof v === 'string' ? v : '');

// PATCH /api/admin/subscription/billing-details  { state, gstNumber? }
// Always allowed, even when the gym is locked, so an expired gym can fill this in before paying.
router.patch('/billing-details', protect, authorize('admin'), handle(async (req, res) => {
  const state = str(req.body.state).trim().slice(0, 60);
  const gstNumber = str(req.body.gstNumber).trim().toUpperCase();
  if (!state) return res.status(400).json({ success: false, message: 'Please select your state' });
  if (gstNumber && !/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(gstNumber)) {
    return res.status(400).json({ success: false, message: 'That GST number does not look right' });
  }
  const update = { state };
  if (gstNumber) Object.assign(update, { gstNumber, gstEnabled: true });
  await Subscriber.updateOne({ _id: req.user.subscriberId }, { $set: update });
  res.json({ success: true, data: { state, gstNumber: gstNumber || null } });
}));

// POST /api/admin/subscription/quote  { plan, cycle }
router.post('/quote', protect, authorize('admin'), handle(async (req, res) => {
  const { quote, rule } = await billing.buildQuote(req.user.subscriberId, str(req.body.plan), str(req.body.cycle));
  res.json({ success: true, data: { quote, startMode: rule.startMode } });
}));

// POST /api/admin/subscription/checkout  { plan, cycle }
router.post('/checkout', protect, authorize('admin'), handle(async (req, res) => {
  const data = await billing.startCheckout(req.user.subscriberId, str(req.body.plan), str(req.body.cycle));
  res.status(201).json({ success: true, data });
}));

// POST /api/admin/subscription/confirm  { razorpay_order_id, razorpay_payment_id, razorpay_signature }
router.post('/confirm', protect, authorize('admin'), handle(async (req, res) => {
  const orderId = str(req.body.razorpay_order_id);
  const paymentId = str(req.body.razorpay_payment_id);
  const signature = str(req.body.razorpay_signature);
  if (!orderId || !paymentId || !signature) {
    return res.status(400).json({ success: false, message: 'Payment details are missing' });
  }
  const p = await billing.confirmCheckout(req.user.subscriberId, { orderId, paymentId, signature });
  res.json({ success: true, data: { status: p.status, invoiceNo: p.invoiceNo, periodEnd: p.periodEnd } });
}));

// Dev and test only: completes a dummy-gateway order. Never exists in production.
router.post('/simulate', protect, authorize('admin'), handle(async (req, res) => {
  if (!gateway.simulationAllowed()) return res.status(404).json({ success: false, message: 'Not found' });
  const p = await SubscriptionPayment.findOne({ subscriberId: req.user.subscriberId, razorpayOrderId: str(req.body.orderId), provider: 'dummy' });
  if (!p) return res.status(404).json({ success: false, message: 'Order not found' });
  const done = await billing.activate({ orderId: p.razorpayOrderId, paymentId: `pay_dummy_${Date.now()}` });
  res.json({ success: true, data: { status: done.status, invoiceNo: done.invoiceNo, periodEnd: done.periodEnd } });
}));

// GET /api/admin/subscription/payments
router.get('/payments', protect, authorize('admin'), handle(async (req, res) => {
  const list = await SubscriptionPayment.find({ subscriberId: req.user.subscriberId, status: 'paid' }).sort({ paidAt: -1 }).limit(100);
  res.json({ success: true, data: list });
}));

// GET /api/admin/subscription/payments/:id/invoice
router.get('/payments/:id/invoice', protect, authorize('admin'), handle(async (req, res) => {
  const p = await SubscriptionPayment.findOne({ _id: req.params.id, subscriberId: req.user.subscriberId, status: 'paid' });
  if (!p) return res.status(404).json({ success: false, message: 'Invoice not found' });
  streamSubscriptionInvoice(res, p);
}));

module.exports = router;
