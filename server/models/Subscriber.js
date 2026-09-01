const mongoose = require('mongoose');

const subscriberSchema = new mongoose.Schema({
  gymName: {
    type: String,
    required: true,
    trim: true
  },
  plan: {
    type: String,
    enum: ['free', 'starter', 'basic', 'premium'],
    default: 'free'
  },
  isActive: {
    type: Boolean,
    default: true
  },
  trialEndsAt: {
    type: Date
  },
  planStartedAt: {
    type: Date
  },
  // Doc's "block vs warn-but-allow" toggle for check-in on an expired/frozen plan.
  attendanceGraceMode: {
    type: String,
    enum: ['block', 'warn'],
    default: 'block'
  }
}, { timestamps: true });

module.exports = mongoose.model('Subscriber', subscriberSchema);
