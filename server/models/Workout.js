const mongoose = require('mongoose');

// Manually authored workout routines — see AIPlan for AI-generated workout + diet plans.
const workoutSchema = new mongoose.Schema(
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
    subAdminId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'SubAdmin',
    },
    planData: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    generatedBy: {
      type: String,
      enum: ['manual', 'ai'],
      default: 'manual',
    },
  },
  { timestamps: true }
);

workoutSchema.index({ subscriberId: 1, memberId: 1 });

module.exports = mongoose.model('Workout', workoutSchema);
