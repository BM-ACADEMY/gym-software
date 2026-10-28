const mongoose = require('mongoose');

// Discount, partner and referral codes for GymDesk's own subscription checkout
// (Root Admin creates them). Separate from the older Coupon model, which was tied
// to the legacy PlatformPlan documents and is not used by checkout.
const schema = new mongoose.Schema(
  {
    code: { type: String, required: true, unique: true, uppercase: true, trim: true, match: /^[A-Z0-9_-]{3,24}$/ },
    kind: { type: String, enum: ['offer', 'partner', 'referral'], default: 'offer' },
    // Who gets the credit when kind is partner/referral (free text, e.g. the partner's name).
    ownerLabel: { type: String, trim: true, maxlength: 80 },
    percentOff: { type: Number, required: true, min: 1, max: 50 },
    // Only the gym's first paid subscription payment can use it.
    firstPaymentOnly: { type: Boolean, default: true },
    planKeys: { type: [String], default: [] }, // empty = all plans
    maxRedemptions: { type: Number, min: 1 },
    redeemedCount: { type: Number, default: 0 },
    expiresAt: Date,
    isActive: { type: Boolean, default: true },
    note: { type: String, maxlength: 200 },
  },
  { timestamps: true }
);

module.exports = mongoose.model('PromoCode', schema);
