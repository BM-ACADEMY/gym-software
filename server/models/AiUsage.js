const mongoose = require('mongoose');

// One row per AI call that cost us money (assistant question, insight, plan).
// Monthly caps per plan are enforced by counting these.
const aiUsageSchema = new mongoose.Schema({
  subscriberId: { type: mongoose.Schema.Types.ObjectId, ref: 'Subscriber', required: true },
  kind: { type: String, enum: ['assistant', 'insight'], required: true },
  createdAt: { type: Date, default: Date.now },
});
aiUsageSchema.index({ subscriberId: 1, createdAt: -1 });

module.exports = mongoose.model('AiUsage', aiUsageSchema);
