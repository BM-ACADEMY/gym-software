const mongoose = require('mongoose');

const schema = new mongoose.Schema(
  {
    subscriberId: { type: mongoose.Schema.Types.ObjectId, ref: 'Subscriber', required: true },
    classId: { type: mongoose.Schema.Types.ObjectId, ref: 'GymClass', required: true },
    memberId: { type: mongoose.Schema.Types.ObjectId, ref: 'Member', required: true },
    status: { type: String, enum: ['booked', 'waitlist', 'cancelled'], required: true },
    cancelledAt: Date,
  },
  { timestamps: true }
);

// A member can hold only one live (booked or waitlisted) place per class.
schema.index(
  { classId: 1, memberId: 1 },
  { unique: true, partialFilterExpression: { status: { $in: ['booked', 'waitlist'] } } }
);
schema.index({ subscriberId: 1, memberId: 1, createdAt: -1 });

module.exports = mongoose.model('ClassBooking', schema);
