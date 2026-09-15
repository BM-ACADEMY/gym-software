const PlatformPayment = require('../../models/PlatformPayment');
const { createOrder, buildSimulatedWebhook } = require('../../services/paymentGateway');
const { processPaymentWebhook, processRazorpayPayment } = require('../../services/webhookProcessor');

// @desc    View this gym's own platform-subscription invoices
// @route   GET /api/admin/billing/invoices
const listMyInvoices = async (req, res) => {
  try {
    const invoices = await PlatformPayment.find({ subscriberId: req.user.subscriberId }).populate('planId', 'name price').sort({ createdAt: -1 });
    res.status(200).json({ success: true, message: 'Invoices fetched successfully', data: invoices });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Create a gateway checkout order for a pending/failed platform invoice
// @route   POST /api/admin/billing/invoices/:id/checkout
const createCheckout = async (req, res) => {
  try {
    const invoice = await PlatformPayment.findOne({ _id: req.params.id, subscriberId: req.user.subscriberId });
    if (!invoice) return res.status(404).json({ success: false, message: 'Invoice not found' });
    if (invoice.status === 'paid') return res.status(400).json({ success: false, message: 'Already paid' });

    const order = await createOrder({ amount: invoice.amount, receipt: invoice.invoiceNumber, notes: { platformPaymentId: String(invoice._id) } });
    invoice.gatewayOrderId = order.orderId;
    await invoice.save();

    res.status(201).json({ success: true, message: 'Checkout order created', data: order });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Dummy-gateway only: simulates a successful payment callback for the platform invoice
// @route   POST /api/admin/billing/invoices/:id/simulate-payment
const simulatePayment = async (req, res) => {
  try {
    const invoice = await PlatformPayment.findOne({ _id: req.params.id, subscriberId: req.user.subscriberId });
    if (!invoice) return res.status(404).json({ success: false, message: 'Invoice not found' });
    if (invoice.status === 'paid') return res.status(400).json({ success: false, message: 'Already paid' });
    if (!invoice.gatewayOrderId) return res.status(400).json({ success: false, message: 'No checkout order found for this invoice — create one first' });

    const { payload, signature } = await buildSimulatedWebhook({ orderId: invoice.gatewayOrderId, status: 'paid', amount: invoice.amount });
    const result = await processPaymentWebhook(payload, signature);

    res.status(200).json({ success: true, message: 'Payment completed', data: result });
  } catch (error) {
    console.error(error);
    res.status(error.status || 500).json({ success: false, message: error.status ? error.message : 'Server error' });
  }
};

// @desc    Real-gateway path: verifies a Razorpay Checkout.js success callback
//          and marks the platform invoice paid
// @route   POST /api/admin/billing/invoices/:id/verify-razorpay
const verifyRazorpay = async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({ success: false, message: 'razorpay_order_id, razorpay_payment_id, and razorpay_signature are required' });
    }
    const invoice = await PlatformPayment.findOne({ _id: req.params.id, subscriberId: req.user.subscriberId, gatewayOrderId: razorpay_order_id });
    if (!invoice) return res.status(404).json({ success: false, message: 'Invoice not found for this order' });

    const result = await processRazorpayPayment({ orderId: razorpay_order_id, paymentId: razorpay_payment_id, signature: razorpay_signature });
    res.status(200).json({ success: true, message: result.duplicate ? 'Already processed' : 'Payment completed', data: result });
  } catch (error) {
    console.error(error);
    res.status(error.status || 500).json({ success: false, message: error.status ? error.message : 'Server error' });
  }
};

module.exports = { listMyInvoices, createCheckout, simulatePayment, verifyRazorpay };
