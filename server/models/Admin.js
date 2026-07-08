const mongoose = require('mongoose');

const adminSchema = new mongoose.Schema({
  subscriberId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Subscriber',
    required: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    unique: true,
    sparse: true, // sparse because they might register via phone only
    lowercase: true,
    trim: true
  },
  phone: {
    type: String,
    unique: true,
    sparse: true
  },
  passwordHash: {
    type: String
  },
  otpCode: {
    type: String
  },
  otpExpiresAt: {
    type: Date
  },
  role: {
    type: String,
    default: 'admin'
  }
}, { timestamps: true });

module.exports = mongoose.model('Admin', adminSchema);
