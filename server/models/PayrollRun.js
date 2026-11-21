const mongoose = require('mongoose');

// One payroll run per gym per month. Payslips are SNAPSHOTS: a later salary change never alters a locked run.
const itemSchema = new mongoose.Schema(
  {
    staffId: { type: mongoose.Schema.Types.ObjectId, ref: 'SubAdmin', required: true },
    name: String,
    roleTitle: String,
    lopDays: { type: Number, default: 0 },
    advanceDue: { type: Number, default: 0 },
    adjustments: [{ _id: false, label: String, kind: { type: String, enum: ['add', 'deduct'] }, amount: Number }],
    payslip: { type: mongoose.Schema.Types.Mixed, required: true }, // computePayslip() result, whole rupees
    daysPresent: Number,
    daysLeave: Number,
  },
  { _id: false }
);

const schema = new mongoose.Schema(
  {
    subscriberId: { type: mongoose.Schema.Types.ObjectId, ref: 'Subscriber', required: true },
    month: { type: String, required: true, match: /^\d{4}-(0[1-9]|1[0-2])$/ },
    status: { type: String, enum: ['draft', 'locked'], default: 'draft' },
    currency: { type: String, default: 'INR' },
    items: [itemSchema],
    totals: { gross: Number, net: Number },
    lockedAt: Date,
  },
  { timestamps: true }
);

schema.index({ subscriberId: 1, month: 1 }, { unique: true });

module.exports = mongoose.model('PayrollRun', schema);
