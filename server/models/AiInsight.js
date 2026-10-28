const mongoose = require('mongoose');

// The dashboard insight for one gym for one IST day (generated once, then cached).
const aiInsightSchema = new mongoose.Schema({
  subscriberId: { type: mongoose.Schema.Types.ObjectId, ref: 'Subscriber', required: true },
  day: { type: String, required: true }, // YYYY-MM-DD in IST
  source: { type: String, enum: ['ai', 'rules'], required: true },
  summary: { type: String, required: true },
  actions: { type: [String], default: [] },
  stats: { type: Object },
  createdAt: { type: Date, default: Date.now },
});
aiInsightSchema.index({ subscriberId: 1, day: 1 }, { unique: true });

module.exports = mongoose.model('AiInsight', aiInsightSchema);
