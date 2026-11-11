'use strict';
// Dine records. The app passes its own mongoose. Every record carries tenantId (the venue) and gets the fail-closed tenant guard.
// DineTenant is the venue itself (not scoped by tenantId). Money: whole rupees with a currency code.
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
  const Tenant = define('DineTenant', {
    venueName: { type: String, required: true, maxlength: 120 }, state: String, currency: { type: String, default: 'INR' },
    trialEndsAt: Date, paidUntil: Date, planKey: String, billingCycle: String, planStartedAt: Date, isActive: { type: Boolean, default: true },
    termsAcceptedAt: Date, termsVersion: String,
    // Owner settings. pubMode adds bar features only; it never switches on any excise report.
    settings: { gstProfile: { type: String, enum: ['per_item', 'flat_5', 'none'], default: 'none' }, serviceChargePct: { type: Number, default: 0, min: 0, max: 20 }, pubMode: { type: Boolean, default: false }, festivals: { type: [Schema.Types.Mixed], default: [] }, happyRules: { type: [Schema.Types.Mixed], default: [] }, discountRule: { type: Schema.Types.Mixed }, reviewLink: String },
  }, [], false);
  const User = define('DineUser', { tenantId: T, name: String, email: { type: String, required: true, unique: true, lowercase: true, trim: true }, role: { type: String, enum: ['admin', 'subadmin'], default: 'admin' }, staffRole: { type: String, default: 'owner' }, passwordHash: { type: String, required: true, select: false }, failedLogins: { type: Number, default: 0 }, lockedUntil: Date, isActive: { type: Boolean, default: true }, lastLoginAt: Date, phone: { type: String, trim: true }, salesContactOk: { type: Boolean, default: false }, salesContactAt: Date });
  const MenuItem = define('DineMenuItem', { tenantId: T, key: { type: String, required: true }, name: { type: String, required: true, maxlength: 120 }, category: String, price: { type: Number, required: true, min: 0 }, currency: { type: String, default: 'INR' }, gstRate: { type: Number, default: 5 }, kind: { type: String, enum: ['food', 'drink', 'liquor'], default: 'food' }, station: { type: String, enum: ['kitchen', 'bar'] }, variants: [Schema.Types.Mixed], groups: [Schema.Types.Mixed], isActive: { type: Boolean, default: true } }, [[{ tenantId: 1, key: 1 }, { unique: true }]]);
  const Order = define('DineOrder', {
    tenantId: T, number: { type: String, required: true }, type: String, table: String, status: { type: String, default: 'open' },
    lines: [Schema.Types.Mixed], events: [Schema.Types.Mixed], guests: Number,
    totals: Schema.Types.Mixed, serviceCharge: { type: Number, default: 0 }, grandTotal: Number, currency: { type: String, default: 'INR' },
    payments: [Schema.Types.Mixed], paidAt: Date, staffId: String, discount: { type: Number, default: 0 }, discountBy: { type: String, enum: ['owner', 'staff'] }, discountById: String, discountPercent: { type: Number, default: 0 }, discountReason: { type: String, maxlength: 200 }, openedDate: String, openedHour: Number,
  }, [[{ tenantId: 1, number: 1 }, { unique: true }], [{ tenantId: 1, status: 1, createdAt: -1 }, {}], [{ tenantId: 1, openedDate: 1 }, {}]]);
  const Counter = define('DineCounter', { tenantId: T, key: { type: String, required: true }, seq: { type: Number, default: 0 } }, [[{ tenantId: 1, key: 1 }, { unique: true }]]);
  const Ingredient = define('DineIngredient', { tenantId: T, name: { type: String, required: true, maxlength: 80 }, unit: { type: String, maxlength: 10 }, costPerUnit: { type: Number, min: 0 }, qty: { type: Number, default: 0 }, reorderLevel: Number }, [[{ tenantId: 1, name: 1 }, { unique: true }]]);
  const Recipe = define('DineRecipe', { tenantId: T, dishKey: { type: String, required: true }, portion: { type: Number, default: 1 }, parts: [Schema.Types.Mixed] }, [[{ tenantId: 1, dishKey: 1 }, { unique: true }]]);
  const Waste = define('DineWaste', { tenantId: T, ingredientId: { type: Schema.Types.ObjectId, required: true }, qty: { type: Number, required: true, min: 0 }, reason: { type: String, maxlength: 60 }, by: String, date: String }, [[{ tenantId: 1, date: 1 }, {}]]);
  const CashEntry = define('DineCash', { tenantId: T, date: { type: String, required: true }, type: { type: String, enum: ['in', 'out'], required: true }, amount: { type: Number, required: true, min: 0 }, category: String, note: { type: String, maxlength: 200 }, by: String, currency: { type: String, default: 'INR' } }, [[{ tenantId: 1, date: 1 }, {}]]);
  const DayClose = define('DineDayClose', { tenantId: T, date: { type: String, required: true }, opening: Number, cashSales: Number, cashIn: Number, cashOut: Number, counted: Number, expected: Number, difference: Number, status: String, by: String }, [[{ tenantId: 1, date: 1 }, { unique: true }]]);
  const Purchase = define('DinePurchase', { tenantId: T, supplier: { type: String, required: true, maxlength: 80 }, date: { type: String, required: true }, amount: { type: Number, required: true, min: 0 }, dueDate: String, note: String, currency: { type: String, default: 'INR' } }, [[{ tenantId: 1, date: 1 }, {}]]);
  const SupplierPayment = define('DineSupplierPayment', { tenantId: T, supplier: { type: String, required: true }, date: { type: String, required: true }, amount: { type: Number, required: true, min: 0 }, currency: { type: String, default: 'INR' } }, [[{ tenantId: 1, date: 1 }, {}]]);
  const Customer = define('DineCustomer', { tenantId: T, name: { type: String, required: true, maxlength: 120 }, phone: { type: String, trim: true }, visits: [String], doNotContact: { type: Boolean, default: false }, birthday: String }, [[{ tenantId: 1, phone: 1 }, { unique: true, partialFilterExpression: { phone: { $type: 'string' } } }]]);
  const Punch = define('DinePunch', { tenantId: T, userId: { type: Schema.Types.ObjectId, required: true }, kind: { type: String, enum: ['in', 'out'], required: true }, at: { type: String, required: true } }, [[{ tenantId: 1, userId: 1, at: 1 }, {}]]);
  const Activity = define('DineActivity', { tenantId: T, by: String, action: String, ref: String, note: String }, [[{ tenantId: 1, createdAt: -1 }, {}]]);
  return { Tenant, User, MenuItem, Order, Counter, Ingredient, Recipe, Waste, CashEntry, DayClose, Purchase, SupplierPayment, Customer, Punch, Activity };
};
