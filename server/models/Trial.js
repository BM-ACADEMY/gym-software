const mongoose = require('mongoose');

const trialSchema = new mongoose.Schema(
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
    phone: {
      type: String,
      required: true,
      trim: true,
    },
    preferredDate: {
      type: Date,
    },
    status: {
      type: String,
      enum: ['booked', 'attended', 'converted', 'lost'],
      default: 'booked',
    },
    assignedSubAdminId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'SubAdmin',
    },
  },
  { timestamps: true }
);

trialSchema.index({ subscriberId: 1, status: 1 });

module.exports = mongoose.model('Trial', trialSchema);
