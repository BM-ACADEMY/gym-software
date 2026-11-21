const mongoose = require('mongoose');

// One scheduled class session (e.g. "Zumba, Sat 7:00 am"). Repeating classes are
// created one session at a time for now.
const schema = new mongoose.Schema(
  {
    subscriberId: { type: mongoose.Schema.Types.ObjectId, ref: 'Subscriber', required: true },
    name: { type: String, required: true, trim: true, maxlength: 80 },
    trainerName: { type: String, trim: true, maxlength: 80 },
    startsAt: { type: Date, required: true },
    durationMin: { type: Number, default: 60, min: 5, max: 480 },
    capacity: { type: Number, required: true, min: 1, max: 500 },
    // Number of confirmed (not waitlisted) bookings. Changed only with atomic updates.
    bookedCount: { type: Number, default: 0, min: 0 },
    status: { type: String, enum: ['scheduled', 'cancelled'], default: 'scheduled' },
  },
  { timestamps: true }
);

schema.index({ subscriberId: 1, startsAt: 1 });

module.exports = mongoose.model('GymClass', schema);
