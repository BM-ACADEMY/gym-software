const mongoose = require('mongoose');

// A gym's own membership plans sold to its members (Monthly/Quarterly/Annual/PT Add-on).
// Fully independent per gym — see PlatformPlan for the SaaS tiers Root Admin sells to gyms.
const gymPlanSchema = new mongoose.Schema(
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
    durationDays: {
      type: Number,
      required: true,
    },
    price: {
      type: Number,
      required: true,
    },
    includedServices: {
      type: [String],
      default: [],
    },
    trialEligible: {
      type: Boolean,
      default: false,
    },
    autoRenew: {
      type: Boolean,
      default: false,
    },
    allowFreeze: {
      type: Boolean,
      default: false,
    },
    maxFreezeDays: {
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

gymPlanSchema.index({ subscriberId: 1 });

module.exports = mongoose.model('GymPlan', gymPlanSchema);
