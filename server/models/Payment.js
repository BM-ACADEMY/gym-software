const mongoose = require('mongoose');

// One contribution toward a Payment's total due — lets a membership fee be
// paid off in installments while the parent record stays the single invoice.
const installmentSchema = new mongoose.Schema(
  {
    amount: { type: Number, required: true },
    method: { type: String, enum: ['cash', 'upi', 'card', 'gateway'], required: true },
    paidAt: { type: Date, default: Date.now },
    note: { type: String, trim: true },
  },
  { _id: false }
);

// A gym member's invoice/payment toward their gym membership plan (cash/UPI/card via gateway).
// `amount` is the total due; `amountPaid` + `installments[]` track partial/installment payments against it.
const paymentSchema = new mongoose.Schema(
  {
    subscriberId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Subscriber',
      required: true,
    },
    memberId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Member',
      required: true,
    },
    amount: {
      type: Number,
      required: true,
    },
    amountPaid: {
      type: Number,
      default: 0,
    },
    installments: {
      type: [installmentSchema],
      default: [],
    },
    dueDate: {
      type: Date,
    },
    method: {
      type: String,
      enum: ['cash', 'upi', 'card', 'gateway'],
      required: true,
    },
    status: {
      type: String,
      enum: ['pending', 'partial', 'paid', 'overdue', 'refunded'],
      default: 'pending',
    },
    note: {
      type: String,
      trim: true,
    },
    invoiceNumber: {
      type: String,
      unique: true,
      sparse: true,
    },
    paidAt: {
      type: Date,
    },
  },
  { timestamps: true }
);

paymentSchema.index({ subscriberId: 1, memberId: 1, paidAt: -1 });

module.exports = mongoose.model('Payment', paymentSchema);
