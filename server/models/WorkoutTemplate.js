const mongoose = require('mongoose');

// The reusable workout library — "Template library reusable across members".
// Assigning one to a member copies its planData into that member's Workout doc
// (see Workout.js); editing a template later does not retroactively change
// members already assigned from it.
const workoutTemplateSchema = new mongoose.Schema(
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
    level: {
      type: String,
      enum: ['beginner', 'intermediate', 'advanced'],
      default: 'beginner',
    },
    daysPerWeek: {
      type: Number,
      default: 3,
    },
    focus: {
      type: String,
      trim: true,
    },
    planData: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    createdBySubAdminId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'SubAdmin',
    },
  },
  { timestamps: true }
);

workoutTemplateSchema.index({ subscriberId: 1 });

module.exports = mongoose.model('WorkoutTemplate', workoutTemplateSchema);
