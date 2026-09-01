const mongoose = require('mongoose');

// A gym owner's payment toward their platform (GymDesk SaaS) subscription — Root Admin billing.
const platformPaymentSchema = new mongoose.Schema(
  {
    subscriberId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Subscriber',
      required: true,
    },
    planId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'PlatformPlan',
      required: true,
    },
    amount: {
      type: Number,
      required: true,
    },
    status: {
      type: String,
      enum: ['pending', 'paid', 'failed', 'refunded'],
      default: 'pending',
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

module.exports = mongoose.model('PlatformPayment', platformPaymentSchema);
