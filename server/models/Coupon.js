const mongoose = require('mongoose');

// Root Admin discount codes — apply only to platform plan checkout, never to gym membership plans.
const couponSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
    },
    discountType: {
      type: String,
      enum: ['percentage', 'flat'],
      required: true,
    },
    discountValue: {
      type: Number,
      required: true,
    },
    applicablePlanIds: {
      // empty array = applies to all platform plans
      type: [mongoose.Schema.Types.ObjectId],
      ref: 'PlatformPlan',
      default: [],
    },
    expiresAt: {
      type: Date,
    },
    usageLimit: {
      type: Number,
    },
    usedCount: {
      type: Number,
      default: 0,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Coupon', couponSchema);
