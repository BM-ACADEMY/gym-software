const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema(
  {
    subscriberId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Subscriber',
      required: true,
    },
    recipientType: {
      type: String,
      enum: ['member', 'subadmin', 'admin'],
      required: true,
    },
    recipientId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },
    type: {
      type: String,
      // e.g. plan_expiring, payment_overdue, pt_session_reminder, trial_lapsing,
      // platform_renewal, new_subadmin_invited, announcement
      required: true,
    },
    channel: {
      type: String,
      enum: ['push', 'email', 'sms', 'in_app'],
      required: true,
    },
    message: {
      type: String,
      trim: true,
    },
    sentAt: {
      type: Date,
    },
    readAt: {
      type: Date,
    },
  },
  { timestamps: true }
);

notificationSchema.index({ subscriberId: 1, recipientType: 1, recipientId: 1, createdAt: -1 });

module.exports = mongoose.model('Notification', notificationSchema);
