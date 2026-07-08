const mongoose = require('mongoose');

const otpRecordSchema = new mongoose.Schema({
  identifier: { // phone or email
    type: String,
    required: true
  },
  type: {
    type: String,
    enum: ['email', 'phone'],
    required: true
  },
  otpCode: {
    type: String,
    required: true
  },
  gymName: { // temporary storage for registration flow
    type: String
  },
  ownerName: {
    type: String
  },
  passwordHash: {
    type: String
  },
  expiresAt: {
    type: Date,
    required: true,
    index: { expires: '10m' } // TTL index: document will be auto-deleted 10 mins after creation
  }
}, { timestamps: true });

module.exports = mongoose.model('OtpRecord', otpRecordSchema);
