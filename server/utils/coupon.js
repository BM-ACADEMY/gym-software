const Coupon = require('../models/Coupon');

// Checks eligibility and computes the discount without mutating anything —
// the Billing/checkout flow (a later task) calls redeemCoupon() at the point
// money actually changes hands; this is also exposed standalone for preview.
const validateCoupon = async (code, { planId, amount } = {}) => {
  const coupon = await Coupon.findOne({ code: String(code).toUpperCase() });
  if (!coupon) return { valid: false, message: 'Coupon not found' };
  if (!coupon.isActive) return { valid: false, message: 'Coupon is not active' };
  if (coupon.expiresAt && coupon.expiresAt < new Date()) return { valid: false, message: 'Coupon has expired' };
  if (coupon.usageLimit && coupon.usedCount >= coupon.usageLimit) return { valid: false, message: 'Coupon usage limit reached' };
  if (coupon.applicablePlanIds.length && planId && !coupon.applicablePlanIds.some((id) => String(id) === String(planId))) {
    return { valid: false, message: 'Coupon is not valid for this plan' };
  }

  let discountAmount = 0;
  if (amount !== undefined) {
    discountAmount = coupon.discountType === 'percentage' ? (amount * coupon.discountValue) / 100 : coupon.discountValue;
    discountAmount = Math.min(discountAmount, amount);
  }

  return { valid: true, coupon, discountAmount };
};

// Validates, then atomically records the redemption. Returns the same shape
// as validateCoupon (valid: false + message on failure).
const redeemCoupon = async (code, { subscriberId, planId, amount }) => {
  const result = await validateCoupon(code, { planId, amount });
  if (!result.valid) return result;

  result.coupon.usedCount += 1;
  result.coupon.redemptions.push({ subscriberId, planId, discountApplied: result.discountAmount });
  await result.coupon.save();

  return result;
};

module.exports = { validateCoupon, redeemCoupon };
