const mongoose = require('mongoose');

// Idempotency ledger: a gateway (or our dummy simulation of one) may retry the
// same webhook delivery — this guarantees each event is only ever applied once,
// via the unique index on (provider, eventId), not by a fragile in-memory check.
const webhookEventSchema = new mongoose.Schema(
  {
    provider: {
      type: String,
      required: true,
    },
    eventId: {
      type: String,
      required: true,
    },
    payload: {
      type: mongoose.Schema.Types.Mixed,
    },
    processedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

webhookEventSchema.index({ provider: 1, eventId: 1 }, { unique: true });

module.exports = mongoose.model('WebhookEvent', webhookEventSchema);
