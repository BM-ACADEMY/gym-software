const mongoose = require('mongoose');

// Money lent to a staff member, recovered from their salary in later payroll runs.
const schema = new mongoose.Schema(
  {
    subscriberId: { type: mongoose.Schema.Types.ObjectId, ref: 'Subscriber', required: true },
    staffId: { type: mongoose.Schema.Types.ObjectId, ref: 'SubAdmin', required: true },
    amount: { type: Number, required: true, min: 1 }, // whole rupees
    currency: { type: String, default: 'INR' },
    recovered: { type: Number, default: 0, min: 0 },
    note: { type: String, trim: true, maxlength: 200 },
    recoveries: [{ _id: false, runId: mongoose.Schema.Types.ObjectId, amount: Number }],
  },
  { timestamps: true }
);

schema.index({ subscriberId: 1, staffId: 1, createdAt: 1 });

module.exports = mongoose.model('StaffAdvance', schema);
