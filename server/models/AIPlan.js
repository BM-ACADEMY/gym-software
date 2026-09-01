const mongoose = require('mongoose');

const progressEntrySchema = new mongoose.Schema(
  {
    loggedAt: { type: Date, default: Date.now },
    weight: { type: Number },
    photos: { type: [String], default: [] },
    measurements: { type: mongoose.Schema.Types.Mixed },
  },
  { _id: false }
);

// AI-generated workout + diet plan. Generation always goes through services/ai.js
// so the model/provider can be swapped without touching this schema or any controller.
const aiPlanSchema = new mongoose.Schema(
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
    workoutJson: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    dietJson: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    progressLog: {
      type: [progressEntrySchema],
      default: [],
    },
    lastRefreshedAt: {
      type: Date,
    },
  },
  { timestamps: true }
);

aiPlanSchema.index({ subscriberId: 1, memberId: 1 });

module.exports = mongoose.model('AIPlan', aiPlanSchema);
