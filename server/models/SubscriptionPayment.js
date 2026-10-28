const mongoose = require('mongoose');

// A gym's payment for its GymDesk subscription (code-defined plans). Separate
// from the legacy PlatformPayment, which is tied to the old PlatformPlan docs.
const schema = new mongoose.Schema(
  {
    subscriberId: { type: mongoose.Schema.Types.ObjectId, ref: 'Subscriber', required: true, index: true },
    planKey: { type: String, enum: ['solo', 'starter', 'growth', 'pro'], required: true },
    cycle: { type: String, enum: ['monthly', 'yearly'], required: true },
    startMode: { type: String, enum: ['now', 'extend'], default: 'now' },
    status: { type: String, enum: ['created', 'paid', 'failed'], default: 'created' },
    // Whole rupees.
    base: Number,
    credit: { type: Number, default: 0 },
    taxable: Number,
    gst: Number,
    cgst: { type: Number, default: 0 },
    sgst: { type: Number, default: 0 },
    igst: { type: Number, default: 0 },
    total: { type: Number, required: true },
    gstMode: String,
    gstRate: Number,
    currency: { type: String, default: 'INR' },
    provider: { type: String, default: 'razorpay' },
    razorpayOrderId: { type: String, unique: true, sparse: true },
    razorpayPaymentId: { type: String },
    invoiceNo: { type: String, unique: true, sparse: true },
    paidAt: Date,
    periodStart: Date,
    periodEnd: Date,
    note: String,
    // Snapshot of the buyer at purchase time, printed on the invoice.
    buyerName: String,
    buyerGstin: String,
    buyerState: String,
  },
  { timestamps: true }
);

module.exports = mongoose.model('SubscriptionPayment', schema);
