const mongoose = require('mongoose');

const slugify = (str) =>
  str
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');

// The catalog of features Root Admin can attach to a platform plan — e.g. a
// plain on/off flag ("Advanced Analytics") or a numeric allowance
// ("AI Plan Generations", 50 /mo). PlatformPlan.features references these.
const planFeatureSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    key: {
      type: String,
      unique: true,
    },
    type: {
      type: String,
      enum: ['toggle', 'count'],
      default: 'toggle',
    },
    // Only meaningful for type: 'count' — e.g. "/mo", "sessions"
    unit: {
      type: String,
      trim: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

planFeatureSchema.pre('validate', function generateKey() {
  if (!this.key && this.name) {
    this.key = slugify(this.name);
  }
});

module.exports = mongoose.model('PlanFeature', planFeatureSchema);
