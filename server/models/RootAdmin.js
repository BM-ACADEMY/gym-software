const mongoose = require('mongoose');

const rootAdminSchema = new mongoose.Schema({
  name: {
    type: String,
    trim: true
  },
  email: {
    type: String,
    unique: true,
    sparse: true,
    lowercase: true,
    trim: true
  },
  phone: {
    type: String,
    trim: true,
    unique: true,
    sparse: true
  },
  passwordHash: {
    type: String,
    required: true
  },
  otpCode: {
    type: String
  },
  otpExpiresAt: {
    type: Date
  },
  role: {
    type: String,
    default: 'root_admin'
  },
  // Internal team members go through Request Access before they can log in.
  status: {
    type: String,
    enum: ['approved', 'pending', 'rejected'],
    default: 'approved'
  },
  // Set by the approving Root Admin — doc: "sets their internal permission level".
  permissionLevel: {
    type: String,
    enum: ['full', 'support', 'billing'],
    default: 'full'
  }
}, { timestamps: true });

module.exports = mongoose.model('RootAdmin', rootAdminSchema);
