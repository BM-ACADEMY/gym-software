const mongoose = require('mongoose');

// "I contacted this member" taps on the Renewal Copilot list. Used to hide a member from the
// list for a few days and, later, to measure how many chased members renewed.
const copilotActionSchema = new mongoose.Schema({
  subscriberId: { type: mongoose.Schema.Types.ObjectId, ref: 'Subscriber', required: true },
  memberId: { type: mongoose.Schema.Types.ObjectId, ref: 'Member', required: true },
  kind: { type: String, enum: ['renew', 'lapsed', 'dues', 'absent'], required: true },
  actedBy: { type: mongoose.Schema.Types.ObjectId },
  createdAt: { type: Date, default: Date.now },
});
copilotActionSchema.index({ subscriberId: 1, memberId: 1, kind: 1, createdAt: -1 });

module.exports = mongoose.model('CopilotAction', copilotActionSchema);
