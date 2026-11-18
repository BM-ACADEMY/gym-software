const mongoose = require('mongoose');

// A person who asked about the gym. One lead per phone per gym: a repeat enquiry updates the same lead.
const leadSchema = new mongoose.Schema({
  subscriberId: { type: mongoose.Schema.Types.ObjectId, ref: 'Subscriber', required: true },
  name: { type: String, required: true, trim: true },
  phone: { type: String, required: true }, // 10 digits
  goal: { type: String, trim: true },
  note: { type: String, trim: true },
  source: { type: String, enum: ['form', 'walkin', 'phone', 'instagram', 'other'], default: 'other' },
  status: { type: String, enum: ['new', 'contacted', 'trial', 'joined', 'lost'], default: 'new' },
  nextFollowUpAt: { type: Date },
  // The public form needs a ticked box; the date is kept as proof the person agreed to be contacted.
  consentAt: { type: Date },
  enquiries: { type: Number, default: 1 },
}, { timestamps: true });
leadSchema.index({ subscriberId: 1, phone: 1 }, { unique: true });
leadSchema.index({ subscriberId: 1, status: 1, createdAt: -1 });

module.exports = mongoose.model('Lead', leadSchema);
