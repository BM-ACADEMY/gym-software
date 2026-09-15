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
  // The real link to a PlatformPlan document (name/price/limits/features) —
  // `plan` above predates PlatformPlan existing as a full collection and is
  // kept only for backward-compat display, not billing logic.
  platformPlanId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'PlatformPlan'
  },
  nextBillingDate: {
    type: Date
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
  },
  // Gym Owner Settings — branding for the member-facing app.
  logoUrl: {
    type: String,
    trim: true
  },
  brandColor: {
    type: String,
    trim: true,
    default: '#0d9488'
  },
  // Free-form per-day schedule, e.g. { monday: { open: '06:00', close: '21:00', closed: false }, ... }
  workingHours: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  holidays: {
    type: [{ date: { type: Date, required: true }, label: { type: String, trim: true } }],
    default: []
  },
  memberIdFormat: {
    type: String,
    trim: true,
    default: 'MEM-{seq}'
  },
  staffIdFormat: {
    type: String,
    trim: true,
    default: 'STF-{seq}'
  },
  // Doc: sub-admin AI Plan drafts "cannot publish without owner review (configurable)".
  aiPlanReviewRequired: {
    type: Boolean,
    default: true
  },
  // Accounts module's GST summary — off by default since not every gym is
  // GST-registered; revenue/eligible-expense figures are treated as GST-inclusive
  // at this rate when computing the output/input tax split.
  gstEnabled: {
    type: Boolean,
    default: false
  },
  gstNumber: {
    type: String,
    trim: true
  },
  gstRate: {
    type: Number,
    default: 18
  }
}, { timestamps: true });

module.exports = mongoose.model('Subscriber', subscriberSchema);
