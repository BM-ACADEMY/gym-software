'use strict';
// Salon (Groom) records. The app passes its own mongoose. Every record carries tenantId (the business) and every query
// in routes filters by it; the tenant guard (packages/core-server) throws if a query runs outside a tenant context.
// Money: whole rupees with a currency code. Times: minutes from midnight (600 = 10:00), dates 'YYYY-MM-DD' in IST.
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
  // The business itself: not scoped by tenantId.
  const Tenant = define('SalonTenant', {
    businessName: { type: String, required: true, maxlength: 120 }, state: String, preset: { type: String, enum: ['salon', 'spa', 'barber', 'clinic'], default: 'salon' },
    currency: { type: String, default: 'INR' }, trialEndsAt: Date, paidUntil: Date, planKey: String, billingCycle: String, planStartedAt: Date, isActive: { type: Boolean, default: true },
    termsAcceptedAt: Date, termsVersion: String,
    // Public booking link: secret token. Rotating it kills the old link.
    bookingToken: { type: String, index: true, unique: true, sparse: true },
    bookingMode: { type: String, enum: ['instant', 'approve'], default: 'instant' },
    windows: { type: [[Number]], default: [[600, 780], [1080, 1260]] }, closedWeekdays: { type: [Number], default: [0] }, // 0 = Sunday
    slotStep: { type: Number, default: 30 }, bufferMins: { type: Number, default: 0 },
    taxMode: { type: String, enum: ['gst_inclusive', 'gst_exclusive', 'none'], default: 'none' }, gstin: { type: String, maxlength: 15 }, address: { type: String, maxlength: 200 }, phone: String,
    commissionRules: Schema.Types.Mixed, // { default, byService, byStaff, byStaffService } see src/commission.js
  }, [], false);
  const User = define('SalonUser', {
    tenantId: T, name: String, email: { type: String, required: true, unique: true, lowercase: true, trim: true }, role: { type: String, enum: ['admin', 'staff'], default: 'admin' },
    staffId: Schema.Types.ObjectId, passwordHash: { type: String, required: true, select: false }, failedLogins: { type: Number, default: 0 }, lockedUntil: Date,
    isActive: { type: Boolean, default: true }, lastLoginAt: Date, phone: { type: String, trim: true },
  });
  const Service = define('SalonService', {
    tenantId: T, key: { type: String, required: true, maxlength: 40 }, name: { type: String, required: true, maxlength: 80 }, mins: { type: Number, required: true, min: 5, max: 600 },
    price: { type: Number, default: 0, min: 0 }, currency: { type: String, default: 'INR' }, gstRate: { type: Number, default: 0 }, hsn: { type: String, maxlength: 12 }, cycleDays: Number, isActive: { type: Boolean, default: true },
  }, [[{ tenantId: 1, key: 1 }, { unique: true }]]);
  const Staff = define('SalonStaff', {
    tenantId: T, name: { type: String, required: true, maxlength: 80 }, phone: String, serviceKeys: [String], isActive: { type: Boolean, default: true },
  });
  const Customer = define('SalonCustomer', {
    tenantId: T, name: { type: String, required: true, maxlength: 120 }, phone: { type: String, required: true }, note: { type: String, maxlength: 300 },
    preferredStaffId: Schema.Types.ObjectId, birthday: String, anniversary: String, doNotContact: { type: Boolean, default: false },
    lastVisit: String, lastServiceKey: String,
    consent: { at: Date, source: String }, // booking-link consent tick, or owner records that the customer agreed
  }, [[{ tenantId: 1, phone: 1 }, { unique: true }]]);
  // `active` is true while the visit holds the slot (booked or pending). The unique index only covers active rows,
  // so two people tapping the same slot cannot both win, and a cancelled visit frees the slot again.
  const Appointment = define('SalonAppointment', {
    tenantId: T, staffId: { type: Schema.Types.ObjectId, required: true }, customerId: { type: Schema.Types.ObjectId, required: true },
    serviceKey: { type: String, required: true }, serviceName: String, date: { type: String, required: true }, start: { type: Number, required: true }, mins: { type: Number, required: true },
    status: { type: String, enum: ['booked', 'pending', 'done', 'noshow', 'cancelled'], default: 'booked' }, active: { type: Boolean, default: true },
    source: { type: String, enum: ['owner', 'public', 'walkin'], default: 'owner' }, advance: Number, currency: { type: String, default: 'INR' }, billId: Schema.Types.ObjectId,
  }, [[{ tenantId: 1, staffId: 1, date: 1, start: 1 }, { unique: true, partialFilterExpression: { active: true } }], [{ tenantId: 1, date: 1 }, {}]]);
  const Queue = define('SalonQueue', {
    tenantId: T, name: { type: String, required: true, maxlength: 120 }, phone: String, serviceKey: String, staffId: Schema.Types.ObjectId, status: { type: String, enum: ['waiting', 'serving', 'done', 'left'], default: 'waiting' }, date: { type: String, required: true },
  }, [[{ tenantId: 1, date: 1, status: 1 }, {}]]);
  const Bill = define('SalonBill', {
    tenantId: T, number: { type: String, required: true }, customerId: Schema.Types.ObjectId, appointmentId: Schema.Types.ObjectId, clientId: String, date: { type: String, required: true },
    lines: [Schema.Types.Mixed], subtotal: Number, discount: Number, discountReason: { type: String, maxlength: 120 }, taxable: Number, gst: Number, cgst: Number, sgst: Number, igst: Number, total: Number,
    taxMode: String, gstMode: String, currency: { type: String, default: 'INR' }, payments: [Schema.Types.Mixed], received: Number, due: Number, status: String,
    commissions: Schema.Types.Mixed, // { staffId: rupees }
  }, [[{ tenantId: 1, number: 1 }, { unique: true }], [{ tenantId: 1, clientId: 1 }, { unique: true, partialFilterExpression: { clientId: { $type: 'string' } } }], [{ tenantId: 1, date: 1 }, {}]]);
  const Counter = define('SalonCounter', { tenantId: T, key: { type: String, required: true }, seq: { type: Number, default: 0 } }, [[{ tenantId: 1, key: 1 }, { unique: true }]]);
  return { Tenant, User, Service, Staff, Customer, Appointment, Queue, Bill, Counter };
};
