const mongoose = require('mongoose');

// One autopilot report for one gym and one finished period (IST week or month). Made once; the unique index makes repeats harmless.
// Holds counts and rupee totals only: no member names or phones.
const ownerReportSchema = new mongoose.Schema({
  subscriberId: { type: mongoose.Schema.Types.ObjectId, ref: 'Subscriber', required: true },
  period: { type: String, enum: ['weekly', 'monthly'], required: true },
  key: { type: String, required: true }, // Monday YYYY-MM-DD for weekly, YYYY-MM for monthly
  label: { type: String, required: true },
  data: { type: Object, required: true },
  // ready = waiting for the owner (suggest mode); sent = went to the owner's WhatsApp; dismissed = owner hid it
  status: { type: String, enum: ['ready', 'sent', 'dismissed'], default: 'ready' },
  sentAt: { type: Date },
  createdAt: { type: Date, default: Date.now },
});
ownerReportSchema.index({ subscriberId: 1, period: 1, key: 1 }, { unique: true });

module.exports = mongoose.model('OwnerReport', ownerReportSchema);
