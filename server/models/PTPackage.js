const mongoose = require('mongoose');

// A bundle of PT sessions a gym sells at a fixed price (e.g. "10 sessions —
// Rs. 8000") — cheaper per-session than paying one at a time. Independent
// per gym, same pattern as GymPlan.
const ptPackageSchema = new mongoose.Schema(
  {
    subscriberId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Subscriber',
      required: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    sessionCount: {
      type: Number,
      required: true,
      min: 1,
    },
    price: {
      type: Number,
      required: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

ptPackageSchema.index({ subscriberId: 1 });

module.exports = mongoose.model('PTPackage', ptPackageSchema);
