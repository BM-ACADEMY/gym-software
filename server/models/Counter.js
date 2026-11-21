const mongoose = require('mongoose');

// Gap-free sequence counters (invoice numbers per financial year).
const counterSchema = new mongoose.Schema({
  _id: { type: String },
  seq: { type: Number, default: 0 },
});

module.exports = mongoose.model('Counter', counterSchema);
