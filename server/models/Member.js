const mongoose = require('mongoose');

const freezeEntrySchema = new mongoose.Schema(
  {
    startedAt: { type: Date, required: true },
    endsAt: { type: Date, required: true },
    reason: { type: String, trim: true },
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
  },
  { timestamps: true }
);

memberSchema.index({ subscriberId: 1, status: 1 });
memberSchema.index({ subscriberId: 1, assignedSubAdminId: 1 });

module.exports = mongoose.model('Member', memberSchema);
