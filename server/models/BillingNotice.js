const mongoose = require('mongoose');

// One row per automatic billing email sent to a gym owner (trial ending, renewal
// due, grace, expired, welcome). The unique key stops the same email going twice.
const billingNoticeSchema = new mongoose.Schema({
  subscriberId: { type: mongoose.Schema.Types.ObjectId, ref: 'Subscriber', required: true },
  kind: { type: String, required: true },
  key: { type: String, required: true, unique: true },
  to: { type: String },
  sentAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('BillingNotice', billingNoticeSchema);
