const mongoose = require('mongoose');

// Every sub-admin action is attributable — written on every sensitive write
// (permission changes, payment edits, attendance marks, etc.) so the Gym Owner
// can always see who changed what.
const auditLogSchema = new mongoose.Schema(
  {
    subscriberId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Subscriber',
      required: true,
    },
    actingRole: {
      type: String,
      enum: ['root_admin', 'admin', 'subadmin'],
      required: true,
    },
    actingUserId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },
    module: {
      type: String,
      required: true,
    },
    action: {
      type: String,
      required: true,
    },
    targetId: {
      type: mongoose.Schema.Types.ObjectId,
    },
    timestamp: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: false }
);

auditLogSchema.index({ subscriberId: 1, timestamp: -1 });

module.exports = mongoose.model('AuditLog', auditLogSchema);
