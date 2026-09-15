const mongoose = require('mongoose');

// Permission entry for a single module, e.g. permissions.get('members') -> { view: true, edit: true }
const modulePermissionSchema = new mongoose.Schema(
  {
    view: { type: Boolean, default: false },
    edit: { type: Boolean, default: false },
    // When true, this sub-admin sees every member/session in the gym for this
    // module instead of only the ones assigned to them (doc's data-boundary rule).
    viewAll: { type: Boolean, default: false },
  },
  { _id: false }
);

const subAdminSchema = new mongoose.Schema(
  {
    subscriberId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Subscriber',
      required: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      lowercase: true,
      trim: true,
    },
    phone: {
      type: String,
    },
    passwordHash: {
      type: String,
    },
    otpCode: {
      type: String,
    },
    otpExpiresAt: {
      type: Date,
    },
    role: {
      type: String,
      default: 'subadmin',
    },
    // Which pre-built template this was created from — 'custom' if hand-tuned.
    template: {
      type: String,
      enum: ['trainer', 'frontdesk', 'accountant', 'custom'],
      default: 'custom',
    },
    // Keyed by module (matches client/src/config/navigation.js SUBADMIN_NAV keys).
    permissions: {
      type: Map,
      of: modulePermissionSchema,
      default: {},
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    // Meaningful only for template: 'trainer' — the Trainers module's own fields.
    specialization: {
      type: String,
      trim: true,
    },
    baseSalary: {
      type: Number,
    },
    ptCommissionPercent: {
      type: Number,
      min: 0,
      max: 100,
    },
    // Free-text for their own Settings page, e.g. "Mon-Sat 6am-9pm".
    availability: {
      type: String,
      trim: true,
    },
    notificationPreferences: {
      sms: { type: Boolean, default: true },
      email: { type: Boolean, default: true },
      whatsapp: { type: Boolean, default: false },
    },
  },
  { timestamps: true }
);

// `sparse` alone doesn't give true "optional field" semantics on a compound
// index once another field (subscriberId) is always present — Mongo only
// skips a sparse compound index entry when EVERY indexed field is missing,
// so two email-less sub-admins in the same gym would collide as duplicates.
// A partial index keyed on "this field actually exists" avoids that.
subAdminSchema.index(
  { subscriberId: 1, email: 1 },
  { unique: true, partialFilterExpression: { email: { $type: 'string' } } }
);
subAdminSchema.index(
  { subscriberId: 1, phone: 1 },
  { unique: true, partialFilterExpression: { phone: { $type: 'string' } } }
);

module.exports = mongoose.model('SubAdmin', subAdminSchema);
