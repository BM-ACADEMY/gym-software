const mongoose = require('mongoose');

const freezeEntrySchema = new mongoose.Schema(
  {
    startedAt: { type: Date, required: true },
    endsAt: { type: Date, required: true },
    reason: { type: String, trim: true },
  },
  { _id: false }
);

const progressEntrySchema = new mongoose.Schema(
  {
    weight: { type: Number },
    measurements: { type: String, trim: true },
    photoUrl: { type: String, trim: true },
    loggedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const memberSchema = new mongoose.Schema(
  {
    subscriberId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Subscriber',
      required: true,
    },
    assignedSubAdminId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'SubAdmin',
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    phone: {
      type: String,
      trim: true,
    },
    email: {
      type: String,
      lowercase: true,
      trim: true,
    },
    photo: {
      type: String,
      trim: true,
    },
    passwordHash: {
      type: String,
    },
    otpCode: {
      type: String,
    },
    otpExpiresAt: {
      type: Date,
    },
    gender: {
      type: String,
      enum: ['male', 'female', 'other'],
    },
    goal: {
      type: String,
      trim: true,
    },
    medicalNotes: {
      type: String,
      trim: true,
    },
    // Doc's AI Plan input: "goal, body stats, medical notes, and equipment available".
    equipmentAvailable: {
      type: String,
      trim: true,
    },
    planId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'GymPlan',
    },
    expiresAt: {
      type: Date,
    },
    status: {
      type: String,
      enum: ['trial', 'active', 'expiring', 'expired', 'frozen', 'cancelled'],
      default: 'active',
    },
    freezeHistory: {
      type: [freezeEntrySchema],
      default: [],
    },
    // Weight/measurements/photo log — feeds the (future) AI plan refresh and,
    // for now, is real self-tracked progress data on its own.
    progressLog: {
      type: [progressEntrySchema],
      default: [],
    },
    notificationPreferences: {
      sms: { type: Boolean, default: true },
      email: { type: Boolean, default: true },
      whatsapp: { type: Boolean, default: false },
    },
  },
  { timestamps: true }
);

memberSchema.index({ subscriberId: 1, status: 1 });
memberSchema.index({ subscriberId: 1, assignedSubAdminId: 1 });

module.exports = mongoose.model('Member', memberSchema);
