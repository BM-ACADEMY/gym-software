const Payment = require('../../models/Payment');
const Member = require('../../models/Member');
const Subscriber = require('../../models/Subscriber');
const { createOrder, buildSimulatedWebhook } = require('../../services/paymentGateway');
const { processPaymentWebhook, processRazorpayPayment } = require('../../services/webhookProcessor');
const { streamInvoicePdf } = require('../../utils/invoicePdf');

// @desc    View own payment history / invoices
// @route   GET /api/member/payments
const listMyPayments = async (req, res) => {
  try {
    const payments = await Payment.find({ memberId: req.user.id }).sort({ createdAt: -1 });
    const data = payments.map((p) => ({ ...p.toObject(), balanceDue: Math.max(0, p.amount - p.amountPaid) }));
    res.status(200).json({ success: true, message: 'Payments fetched successfully', data });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Create a gateway checkout order for the remaining balance on an invoice
// @route   POST /api/member/payments/:id/checkout
const createCheckout = async (req, res) => {
  try {
    const payment = await Payment.findOne({ _id: req.params.id, memberId: req.user.id });
    if (!payment) return res.status(404).json({ success: false, message: 'Invoice not found' });
    if (['paid', 'refunded'].includes(payment.status)) {
      return res.status(400).json({ success: false, message: `This invoice is already ${payment.status}` });
    }

    const remaining = payment.amount - payment.amountPaid;
    const order = await createOrder({ amount: remaining, receipt: payment.invoiceNumber, notes: { paymentId: String(payment._id) } });
    payment.gatewayOrderId = order.orderId;
    await payment.save();

    res.status(201).json({ success: true, message: 'Checkout order created', data: order });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Dummy-gateway only: simulates the gateway calling our webhook back
//          with a successful payment for the order just created — this is
//          what lets "Pay Online" complete without a real gateway account.
//          Swapping in Razorpay/Stripe later means removing this endpoint
//          and pointing their hosted checkout at the real webhook instead —
//          the webhook/idempotency code underneath doesn't change at all.
// @route   POST /api/member/payments/:id/simulate-payment
const simulatePayment = async (req, res) => {
  try {
    const payment = await Payment.findOne({ _id: req.params.id, memberId: req.user.id });
    if (!payment) return res.status(404).json({ success: false, message: 'Invoice not found' });
    if (payment.status === 'paid') return res.status(400).json({ success: false, message: 'This invoice is already paid' });
    if (!payment.gatewayOrderId) {
      return res.status(400).json({ success: false, message: 'No checkout order found for this invoice — create one first' });
    }

    const remaining = payment.amount - payment.amountPaid;
    const { payload, signature } = await buildSimulatedWebhook({ orderId: payment.gatewayOrderId, status: 'paid', amount: remaining });
    const result = await processPaymentWebhook(payload, signature);

    res.status(200).json({ success: true, message: 'Payment completed', data: result });
  } catch (error) {
    console.error(error);
    res.status(error.status || 500).json({ success: false, message: error.status ? error.message : 'Server error' });
  }
};

// @desc    Real-gateway path: verifies a Razorpay Checkout.js success callback
//          and marks the invoice paid — the counterpart to simulatePayment
//          above for when Root Admin has configured real Razorpay credentials.
// @route   POST /api/member/payments/:id/verify-razorpay
const verifyRazorpay = async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({ success: false, message: 'razorpay_order_id, razorpay_payment_id, and razorpay_signature are required' });
    }
    const payment = await Payment.findOne({ _id: req.params.id, memberId: req.user.id, gatewayOrderId: razorpay_order_id });
    if (!payment) return res.status(404).json({ success: false, message: 'Invoice not found for this order' });

    const result = await processRazorpayPayment({ orderId: razorpay_order_id, paymentId: razorpay_payment_id, signature: razorpay_signature });
    res.status(200).json({ success: true, message: result.duplicate ? 'Already processed' : 'Payment completed', data: result });
  } catch (error) {
    console.error(error);
    res.status(error.status || 500).json({ success: false, message: error.status ? error.message : 'Server error' });
  }
};

// @desc    Manual online-payment recording (staff-assisted UPI/card, no gateway round-trip)
// @route   POST /api/member/payments/:id/pay
const payInvoice = async (req, res) => {
  try {
    const { amount, method } = req.body;
    if (!amount || amount <= 0 || !['upi', 'card'].includes(method)) {
      return res.status(400).json({ success: false, message: 'A positive amount and method (upi/card) are required' });
    }

    const payment = await Payment.findOne({ _id: req.params.id, memberId: req.user.id });
    if (!payment) return res.status(404).json({ success: false, message: 'Invoice not found' });
    if (['paid', 'refunded'].includes(payment.status)) {
      return res.status(400).json({ success: false, message: `This invoice is already ${payment.status}` });
    }

    const remaining = payment.amount - payment.amountPaid;
    if (Number(amount) > remaining) {
      return res.status(400).json({ success: false, message: `Amount exceeds the remaining balance of ${remaining}` });
    }

    payment.installments.push({ amount: Number(amount), method, note: 'Paid online by member' });
    payment.amountPaid += Number(amount);
    payment.method = method;
    payment.status = payment.amountPaid >= payment.amount ? 'paid' : 'partial';
    payment.paidAt = new Date();
    await payment.save();

    res.status(200).json({ success: true, message: 'Payment successful', data: payment });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Download a PDF invoice/receipt for one of my own payments
// @route   GET /api/member/payments/:id/invoice.pdf
const downloadInvoice = async (req, res) => {
  try {
    const payment = await Payment.findOne({ _id: req.params.id, memberId: req.user.id });
    if (!payment) return res.status(404).json({ success: false, message: 'Invoice not found' });

    const [member, subscriber] = await Promise.all([
      Member.findById(req.user.id).select('name phone email'),
      Subscriber.findById(req.user.subscriberId).select('gymName gstEnabled gstNumber gstRate'),
    ]);
    streamInvoicePdf(res, { payment, member, subscriber });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

module.exports = { listMyPayments, createCheckout, simulatePayment, verifyRazorpay, payInvoice, downloadInvoice };
