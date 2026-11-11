'use strict';
// Wash records. The app passes its own mongoose. Every record carries tenantId (the wash business) and every query in
// routes filters by it. Money: whole rupees with a currency code. Dates for passes and washes are 'YYYY-MM-DD' (IST).
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
  const Tenant = define('WashTenant', { businessName: { type: String, required: true, maxlength: 120 }, state: String, currency: { type: String, default: 'INR' }, trialEndsAt: Date, paidUntil: Date, planKey: String, billingCycle: String, planStartedAt: Date, isActive: { type: Boolean, default: true }, termsAcceptedAt: Date, termsVersion: String }, [], false);
  const User = define('WashUser', { tenantId: T, name: String, email: { type: String, required: true, unique: true, lowercase: true, trim: true }, role: { type: String, enum: ['admin', 'subadmin'], default: 'admin' }, passwordHash: { type: String, required: true, select: false }, failedLogins: { type: Number, default: 0 }, lockedUntil: Date, isActive: { type: Boolean, default: true }, lastLoginAt: Date, phone: { type: String, trim: true }, salesContactOk: { type: Boolean, default: false }, salesContactAt: Date });
  const Vehicle = define('WashVehicle', { tenantId: T, plate: { type: String, required: true }, klass: { type: String, enum: ['bike', 'hatchback', 'sedan', 'suv', 'other'], required: true }, ownerName: { type: String, maxlength: 120 }, ownerPhone: { type: String, trim: true, maxlength: 15 }, lastWash: String, intervalDays: Number, doNotContact: { type: Boolean, default: false } }, [[{ tenantId: 1, plate: 1 }, { unique: true }]]);
  const Attendant = define('WashAttendant', { tenantId: T, name: { type: String, required: true, maxlength: 80 }, isActive: { type: Boolean, default: true } });
  const PriceList = define('WashPriceList', { tenantId: { ...T, unique: true }, prices: Schema.Types.Mixed, addons: Schema.Types.Mixed, incentive: Schema.Types.Mixed, festivals: [Schema.Types.Mixed], currency: { type: String, default: 'INR' } });
  const Job = define('WashJob', { tenantId: T, number: Number, plate: { type: String, required: true }, klass: String, lines: [Schema.Types.Mixed], total: { type: Number, default: 0 }, currency: { type: String, default: 'INR' }, state: { type: String, enum: ['waiting', 'washing', 'ready', 'delivered', 'cancelled'], default: 'waiting' }, attendantId: Schema.Types.ObjectId, passId: Schema.Types.ObjectId, passCovered: { type: Number, default: 0 }, payments: [Schema.Types.Mixed], startedAt: Date, readyAt: Date, deliveredAt: Date, cancelledAt: Date, day: String }, [[{ tenantId: 1, state: 1, createdAt: -1 }, {}], [{ tenantId: 1, day: 1 }, {}]]);
  const Pass = define('WashPass', { tenantId: T, plate: { type: String, required: true }, washes: Number, used: { type: Number, default: 0 }, startsOn: String, endsOn: String, price: Number, currency: { type: String, default: 'INR' } }, [[{ tenantId: 1, plate: 1, endsOn: -1 }, {}]]);
  const CashClosing = define('WashCashClosing', { tenantId: T, day: { type: String, required: true }, expected: Number, declared: Number, diff: Number, flag: Boolean, openingFloat: Number, upiTotal: Number, cardTotal: Number, by: Schema.Types.ObjectId, currency: { type: String, default: 'INR' } }, [[{ tenantId: 1, day: 1 }, { unique: true }]]);
  const UsageLog = define('WashUsage', { tenantId: T, kind: { type: String, enum: ['photo', 'ai', 'whatsapp'], required: true } }, [[{ tenantId: 1, kind: 1, createdAt: -1 }, {}]]);
  const Expense = define('WashExpense', { tenantId: T, day: { type: String, required: true }, category: { type: String, required: true }, amount: { type: Number, required: true, min: 1 }, paid: { type: Boolean, default: true }, cash: { type: Boolean, default: true }, supplier: { type: String, maxlength: 80 }, note: { type: String, maxlength: 120 }, currency: { type: String, default: 'INR' }, by: Schema.Types.ObjectId }, [[{ tenantId: 1, day: 1 }, {}]]);
  const Attendance = define('WashAttendance', { tenantId: T, attendantId: { type: Schema.Types.ObjectId, required: true }, day: { type: String, required: true }, status: { type: String, enum: ['present', 'absent', 'leave'], required: true } }, [[{ tenantId: 1, attendantId: 1, day: 1 }, { unique: true }]]);
  return { Expense, Attendance, Tenant, User, Vehicle, Attendant, PriceList, Job, Pass, CashClosing, UsageLog };
};
