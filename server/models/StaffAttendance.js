const mongoose = require('mongoose');

// One row per staff member per day (date is the gym-local calendar day, yyyy-mm-dd).
const schema = new mongoose.Schema(
  {
    subscriberId: { type: mongoose.Schema.Types.ObjectId, ref: 'Subscriber', required: true },
    staffId: { type: mongoose.Schema.Types.ObjectId, ref: 'SubAdmin', required: true },
    date: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ },
    status: { type: String, enum: ['present', 'leave', 'absent'], default: 'present' },
    inAt: Date,
    outAt: Date,
    method: { type: String, enum: ['manual', 'biometric'], default: 'manual' },
    note: { type: String, trim: true, maxlength: 200 },
  },
  { timestamps: true }
);

schema.index({ subscriberId: 1, staffId: 1, date: 1 }, { unique: true });
schema.index({ subscriberId: 1, date: 1 });

module.exports = mongoose.model('StaffAttendance', schema);
