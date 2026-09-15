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
    // Which library template this was assigned from, if any — purely for
    // provenance/"members using this template" counts; editing the template
    // later does not retroactively change planData already copied here.
    templateId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'WorkoutTemplate',
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
    // Calendar dates (YYYY-MM-DD strings) the member has marked their workout
    // done — feeds the streak/AI insights the doc describes.
    completedDates: {
      type: [String],
      default: [],
    },
  },
  { timestamps: true }
);

workoutSchema.index({ subscriberId: 1, memberId: 1 });

module.exports = mongoose.model('Workout', workoutSchema);
