const mongoose = require('mongoose');

// One member's purchase of a PT package — the session-credit ledger. Booking
// a session against a purchase increments sessionsUsed; cancelling refunds it.
const ptPackagePurchaseSchema = new mongoose.Schema(
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
    packageId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'PTPackage',
      required: true,
    },
    packageName: {
      // Snapshot — a later edit/deactivation of the package shouldn't rewrite history.
      type: String,
      required: true,
    },
    sessionsTotal: {
      type: Number,
      required: true,
    },
    sessionsUsed: {
      type: Number,
      default: 0,
    },
    paymentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Payment',
    },
  },
  { timestamps: true }
);

ptPackagePurchaseSchema.index({ subscriberId: 1, memberId: 1 });

module.exports = mongoose.model('PTPackagePurchase', ptPackagePurchaseSchema);
