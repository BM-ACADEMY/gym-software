const mongoose = require('mongoose');

// Log of WhatsApp support chat (inbound from gym owners, outbound from the bot).
// messageId is unique so Meta's webhook retries never create a second reply.
const supportMessageSchema = new mongoose.Schema({
  phone: { type: String, required: true, index: true },
  subscriberId: { type: mongoose.Schema.Types.ObjectId, ref: 'Subscriber' },
  direction: { type: String, enum: ['in', 'out'], required: true },
  text: { type: String, maxlength: 4000 },
  messageId: { type: String, unique: true, sparse: true },
  handover: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
});
supportMessageSchema.index({ phone: 1, createdAt: -1 });

module.exports = mongoose.model('SupportMessage', supportMessageSchema);
