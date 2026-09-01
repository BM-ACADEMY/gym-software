const mongoose = require('mongoose');

// Root Admin's own SaaS pricing tiers (Starter/Growth/Pro/Trial) — gates what a
// subscriber gym can do. Not to be confused with GymPlan (the gym's own membership plans).
const platformPlanSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    price: {
      type: Number,
      required: true,
    },
    memberLimit: {
      // null/undefined means unlimited
      type: Number,
    },
    staffLimit: {
      type: Number,
    },
    // References the PlanFeature catalog. `value` only applies to count-type
    // features (e.g. 50 AI plan generations/mo) — ignored for toggle-type.
    features: {
      type: [
        new mongoose.Schema(
          {
            feature: { type: mongoose.Schema.Types.ObjectId, ref: 'PlanFeature', required: true },
            enabled: { type: Boolean, default: true },
            value: { type: Number },
          },
          { _id: false }
        ),
      ],
      default: [],
    },
    trialDays: {
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

module.exports = mongoose.model('PlatformPlan', platformPlanSchema);
