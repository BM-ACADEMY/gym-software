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
    // Failed-payment retry queue + dunning.
    retryCount: {
      type: Number,
      default: 0,
    },
    lastDunningAt: {
      type: Date,
    },
    // Set when a gateway checkout order is created for this invoice — lets an
    // incoming webhook find its way back to the right record.
    gatewayOrderId: {
      type: String,
      unique: true,
      sparse: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('PlatformPayment', platformPaymentSchema);
