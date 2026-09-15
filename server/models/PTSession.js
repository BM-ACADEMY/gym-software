const mongoose = require('mongoose');

const ptSessionSchema = new mongoose.Schema(
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
    // The trainer — a SubAdmin tagged as trainer-type.
    subAdminId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'SubAdmin',
      required: true,
    },
    scheduledAt: {
      type: Date,
      required: true,
    },
    status: {
      type: String,
      enum: ['scheduled', 'completed', 'no_show', 'cancelled'],
      default: 'scheduled',
    },
    noShowPredicted: {
      type: Boolean,
      default: false,
    },
    // Set when this session was booked against a purchased package's credit
    // rather than paid for individually — lets cancellation refund the credit.
    packagePurchaseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'PTPackagePurchase',
    },
  },
  { timestamps: true }
);

ptSessionSchema.index({ subscriberId: 1, subAdminId: 1, scheduledAt: 1 });

module.exports = mongoose.model('PTSession', ptSessionSchema);
