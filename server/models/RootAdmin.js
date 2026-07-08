const mongoose = require('mongoose');

const rootAdminSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  passwordHash: {
    type: String,
    required: true
  },
  role: {
    type: String,
    default: 'root_admin'
  }
}, { timestamps: true });

module.exports = mongoose.model('RootAdmin', rootAdminSchema);
