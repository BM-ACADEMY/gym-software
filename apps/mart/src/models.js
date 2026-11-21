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
  const Settings = define('MartSettings', { tenantId: { ...T, unique: true }, defaultCreditLimit: { type: Number, min: 0 }, overdueGraceDays: { type: Number, default: 15, min: 1, max: 365 }, festivalUplift: { type: Number, default: 1, min: 1, max: 5 }, discountAlertPct: { type: Number, default: 20, min: 5, max: 100 }, deadStockDays: { type: Number, default: 45, min: 7, max: 365 }, discountRule: { staff: { type: String, enum: ['any', 'limit', 'owner_only'] }, maxPercent: { type: Number, min: 0, max: 100 } }, festivals: { type: [{ name: { type: String, maxlength: 60 }, date: String }], default: [] }, upiId: { type: String, maxlength: 80 }, upiName: { type: String, maxlength: 40 }, paidLeaveAllowance: { type: Number, min: 0, max: 60 } });
  const UsageLog = define('MartUsage', { tenantId: T, kind: { type: String, enum: ['billPhoto', 'ai', 'whatsapp'], required: true }, model: String, inTokens: Number, outTokens: Number }, [[{ tenantId: 1, kind: 1, createdAt: -1 }, {}]]);
  const AutopilotSettings = define('MartAutopilot', { tenantId: { ...T, unique: true }, paused: Boolean, quietFrom: Number, quietTo: Number, dailySendLimit: Number, jobs: Schema.Types.Mixed });
  const ActivityLog = define('MartActivity', { tenantId: T, job: String, ref: String, level: String, action: String, text: String }, [[{ tenantId: 1, createdAt: -1 }, {}]]);
  const Expense = define('MartExpense', { tenantId: T, day: { type: String, required: true }, category: { type: String, required: true }, amount: { type: Number, required: true, min: 1 }, currency: { type: String, default: 'INR' }, method: { type: String, enum: ['cash', 'upi', 'card'], default: 'cash' }, note: { type: String, maxlength: 200 }, by: Schema.Types.ObjectId }, [[{ tenantId: 1, day: -1 }, {}]]);
  const Supplier = define('MartSupplier', { tenantId: T, name: { type: String, required: true, trim: true, maxlength: 120 }, phone: { type: String, trim: true, maxlength: 15 }, isActive: { type: Boolean, default: true } }, [[{ tenantId: 1, name: 1 }, {}]]);
  const Purchase = define('MartPurchase', { tenantId: T, supplierId: { type: Schema.Types.ObjectId, required: true }, day: { type: String, required: true }, amount: { type: Number, required: true, min: 1 }, paid: { type: Number, default: 0, min: 0 }, currency: { type: String, default: 'INR' }, paidCash: { type: Number, default: 0 }, note: { type: String, maxlength: 200 }, by: Schema.Types.ObjectId }, [[{ tenantId: 1, supplierId: 1, day: 1 }, {}]]);
  const DayClose = define('MartDayClose', { tenantId: T, day: { type: String, required: true }, openingCash: { type: Number, default: 0 }, expected: Number, counted: Number, diff: Number, currency: { type: String, default: 'INR' }, by: Schema.Types.ObjectId }, [[{ tenantId: 1, day: 1 }, { unique: true }]]);
  // D-30: who gave a discount on which bill (core-pos bills do not carry this, so Mart keeps it beside them).
  const BillDiscount = define('MartBillDiscount', { tenantId: T, billId: { type: Schema.Types.ObjectId, required: true }, day: { type: String, required: true }, by: Schema.Types.ObjectId, role: { type: String, enum: ['staff', 'owner'], required: true }, amount: { type: Number, required: true, min: 1 }, percent: { type: Number, min: 0 }, currency: { type: String, default: 'INR' }, reason: { type: String, maxlength: 120 } }, [[{ tenantId: 1, billId: 1 }, { unique: true }], [{ tenantId: 1, day: -1 }, {}]]);
  // Audit trail (owner reads it): who did what, no customer details. Kept 1 year by the owner's export; never edited.
  const Audit = define('MartAudit', { tenantId: T, by: String, role: String, action: { type: String, required: true, maxlength: 60 }, ref: { type: String, maxlength: 80 } }, [[{ tenantId: 1, createdAt: -1 }, {}]]);
  // UPI payment links the owner made. We only build the link; the owner marks it paid after checking the UPI app (we cannot see the money).
  const UpiLink = define('MartUpiLink', { tenantId: T, amount: { type: Number, required: true, min: 1 }, currency: { type: String, default: 'INR' }, note: { type: String, maxlength: 40 }, link: { type: String, required: true }, status: { type: String, enum: ['created', 'marked_paid', 'cancelled'], default: 'created' }, by: String }, [[{ tenantId: 1, createdAt: -1 }, {}]]);
  // Payroll (area 3). Staff here are people on the shop's payroll; a login is a separate MartUser.
  const Staff = define('MartStaff', { tenantId: T, name: { type: String, required: true, trim: true, maxlength: 120 }, phone: { type: String, trim: true, maxlength: 15 }, monthlySalary: { type: Number, default: 0, min: 0 }, currency: { type: String, default: 'INR' }, joinedOn: String, isActive: { type: Boolean, default: true } }, [[{ tenantId: 1, name: 1 }, {}]]);
  const Attendance = define('MartAttendance', { tenantId: T, staffId: { type: Schema.Types.ObjectId, required: true }, day: { type: String, required: true }, status: { type: String, enum: ['present', 'half', 'absent', 'paid_leave', 'unpaid_leave', 'weekly_off'], required: true } }, [[{ tenantId: 1, staffId: 1, day: 1 }, { unique: true }]]);
  const Advance = define('MartAdvance', { tenantId: T, staffId: { type: Schema.Types.ObjectId, required: true }, day: { type: String, required: true }, amount: { type: Number, required: true, min: 1 }, currency: { type: String, default: 'INR' }, note: { type: String, maxlength: 200 } }, [[{ tenantId: 1, staffId: 1, day: 1 }, {}]]);
  // A shop owner's request to delete the whole shop. A person at Afra handles it (and tells the owner what must be kept by law).
  const DeleteRequest = define('MartDeleteRequest', { tenantId: T, by: String, status: { type: String, enum: ['requested', 'cancelled', 'done'], default: 'requested' } });
  const Tenant = define('MartTenant', { shopName: { type: String, required: true, maxlength: 120 }, state: String, currency: { type: String, default: 'INR' }, trialEndsAt: Date, paidUntil: Date, planKey: String, billingCycle: String, planStartedAt: Date, isActive: { type: Boolean, default: true }, termsAcceptedAt: Date, termsVersion: String }, [], false);
  const User = define('MartUser', { tenantId: T, name: String, email: { type: String, required: true, unique: true, lowercase: true, trim: true }, role: { type: String, enum: ['admin', 'subadmin', 'cashier', 'stockkeeper'], default: 'admin' }, passwordHash: { type: String, required: true, select: false }, failedLogins: { type: Number, default: 0 }, lockedUntil: Date, isActive: { type: Boolean, default: true }, lastLoginAt: Date, phone: { type: String, trim: true }, salesContactOk: { type: Boolean, default: false }, salesContactAt: Date, passwordChangedAt: Date });
  // A planned work shift for one staff member on one day (HH:MM, same day). The owner or a manager enters them.
  const Shift = define('MartShift', { tenantId: T, staffId: { type: Schema.Types.ObjectId, required: true }, day: { type: String, required: true }, start: { type: String, required: true }, end: { type: String, required: true }, note: { type: String, maxlength: 80 } }, [[{ tenantId: 1, staffId: 1, day: 1 }, {}]]);
  return { Shift, UpiLink, Staff, Attendance, Advance, DeleteRequest, Audit, Tenant, User, Expense, BillDiscount, Supplier, Purchase, DayClose, Payment, Settings, UsageLog, AutopilotSettings, ActivityLog };
};
