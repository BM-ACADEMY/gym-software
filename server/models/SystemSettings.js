const mongoose = require('mongoose');

const systemSettingsSchema = new mongoose.Schema({
  key: {
    type: String,
    required: true,
    unique: true
  },
  value: {
    type: mongoose.Schema.Types.Mixed,
    required: true
  },
  description: {
    type: String
  }
}, { timestamps: true });

// Static method to get a setting value
systemSettingsSchema.statics.getSetting = async function(key, defaultValue = null) {
  const setting = await this.findOne({ key });
  return setting ? setting.value : defaultValue;
};

// Static method to upsert a setting
systemSettingsSchema.statics.setSetting = async function(key, value, description) {
  return this.findOneAndUpdate(
    { key },
    { key, value, description },
    { upsert: true, new: true }
  );
};

module.exports = mongoose.model('SystemSettings', systemSettingsSchema);
