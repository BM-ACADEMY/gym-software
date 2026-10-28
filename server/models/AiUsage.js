const mongoose = require('mongoose');

// One row per AI call that cost us money (assistant question, insight, plan).
// Monthly caps per plan are enforced by counting these.
const aiUsageSchema = new mongoose.Schema({
  subscriberId: { type: mongoose.Schema.Types.ObjectId, ref: 'Subscriber', required: true },
  kind: { type: String, enum: ['assistant', 'insight', 'plan'], required: true },
  // Filled from the provider reply so Super Admin can show real usage and cost per gym and product.
  model: { type: String },
  inTokens: { type: Number, default: 0 },
  outTokens: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now },
});
aiUsageSchema.index({ subscriberId: 1, createdAt: -1 });

module.exports = mongoose.model('AiUsage', aiUsageSchema);
