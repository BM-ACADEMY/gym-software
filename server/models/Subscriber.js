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
  }
}, { timestamps: true });

module.exports = mongoose.model('Subscriber', subscriberSchema);
