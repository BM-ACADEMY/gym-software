const mongoose = require('mongoose');

const attendanceSchema = new mongoose.Schema(
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
    checkedInAt: {
      type: Date,
      required: true,
    },
    checkedOutAt: {
      type: Date,
    },
    method: {
      type: String,
      enum: ['qr', 'code', 'manual', 'biometric'],
      required: true,
    },
    // Sub-Admin/staff id if manually marked — for accountability.
    markedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'SubAdmin',
    },
    sessionType: {
      type: String,
      enum: ['general', 'pt_session'],
      default: 'general',
    },
    ptSessionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'PTSession',
    },
  },
  { timestamps: true }
);

attendanceSchema.index({ subscriberId: 1, memberId: 1, checkedInAt: -1 });

module.exports = mongoose.model('Attendance', attendanceSchema);
