const mongoose = require('mongoose');

// The weekly owner coach for one gym for one IST week (made once, on first open that week; progress is worked out live).
const ownerCoachSchema = new mongoose.Schema({
  subscriberId: { type: mongoose.Schema.Types.ObjectId, ref: 'Subscriber', required: true },
  week: { type: String, required: true }, // Monday of the IST week, YYYY-MM-DD
  actions: { type: [Object], default: [] }, // kind, target, rupees (whole), currency, text. No names or phones.
  createdAt: { type: Date, default: Date.now },
});
ownerCoachSchema.index({ subscriberId: 1, week: 1 }, { unique: true });

module.exports = mongoose.model('OwnerCoach', ownerCoachSchema);
