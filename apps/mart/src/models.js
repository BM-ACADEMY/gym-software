'use strict';
// Mart's own records (billing, items, stock, customers, loyalty come from packages/core-pos and carry tenantId too).
// Every record has tenantId; MartTenant is the shop itself, so it is not scoped. Money: whole rupees with a currency code.
const { tenantPlugin } = require('../../../packages/core-server/src');

module.exports = (mongoose) => {
  const { Schema } = mongoose;
  const castId = (v) => new mongoose.Types.ObjectId(String(v));
  const T = { type: Schema.Types.ObjectId, required: true, index: true };
  const define = (name, schema, indexes = [], scoped = true) => {
    if (mongoose.models[name]) return mongoose.models[name];
    const s = new Schema(schema, { timestamps: true });
    indexes.forEach(([f, o]) => s.index(f, o));
    if (scoped) s.plugin(tenantPlugin, { field: 'tenantId', castId });
    return mongoose.model(name, s);
  };
  // A payment against udhaar. The CREDIT side is the pay-later part of a bill (PosBill.credit), so the two never disagree.
  const Payment = define('MartPayment', { tenantId: T, customerId: { type: Schema.Types.ObjectId, required: true }, amount: { type: Number, required: true, min: 1 }, currency: { type: String, default: 'INR' }, method: { type: String, enum: ['cash', 'upi', 'card'], default: 'cash' }, day: { type: String, required: true }, note: { type: String, maxlength: 200 }, by: Schema.Types.ObjectId }, [[{ tenantId: 1, customerId: 1, day: 1 }, {}]]);
  // One row per shop: limits and thresholds the owner can change any time (D-28), with safe defaults in code.
  const Settings = define('MartSettings', { tenantId: { ...T, unique: true }, defaultCreditLimit: { type: Number, min: 0 }, overdueGraceDays: { type: Number, default: 15, min: 1, max: 365 }, festivalUplift: { type: Number, default: 1, min: 1, max: 5 }, discountAlertPct: { type: Number, default: 20, min: 5, max: 100 }, deadStockDays: { type: Number, default: 45, min: 7, max: 365 } });
  const UsageLog = define('MartUsage', { tenantId: T, kind: { type: String, enum: ['billPhoto', 'ai', 'whatsapp'], required: true }, model: String, inTokens: Number, outTokens: Number }, [[{ tenantId: 1, kind: 1, createdAt: -1 }, {}]]);
  const AutopilotSettings = define('MartAutopilot', { tenantId: { ...T, unique: true }, paused: Boolean, quietFrom: Number, quietTo: Number, dailySendLimit: Number, jobs: Schema.Types.Mixed });
  const ActivityLog = define('MartActivity', { tenantId: T, job: String, ref: String, level: String, action: String, text: String }, [[{ tenantId: 1, createdAt: -1 }, {}]]);
  const Tenant = define('MartTenant', { shopName: { type: String, required: true, maxlength: 120 }, state: String, currency: { type: String, default: 'INR' }, trialEndsAt: Date, paidUntil: Date, planKey: String, billingCycle: String, planStartedAt: Date, isActive: { type: Boolean, default: true }, termsAcceptedAt: Date, termsVersion: String }, [], false);
  const User = define('MartUser', { tenantId: T, name: String, email: { type: String, required: true, unique: true, lowercase: true, trim: true }, role: { type: String, enum: ['admin', 'subadmin'], default: 'admin' }, passwordHash: { type: String, required: true, select: false }, failedLogins: { type: Number, default: 0 }, lockedUntil: Date, isActive: { type: Boolean, default: true }, lastLoginAt: Date, phone: { type: String, trim: true }, salesContactOk: { type: Boolean, default: false }, salesContactAt: Date });
  return { Tenant, User, Payment, Settings, UsageLog, AutopilotSettings, ActivityLog };
};
