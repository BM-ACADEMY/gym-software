const PromoCode = require('../models/PromoCode');
const SubscriptionPayment = require('../models/SubscriptionPayment');

const fail = (message) => Object.assign(new Error(message), { status: 400, code: 'bad_promo' });

const normalize = (code) => String(code || '').trim().toUpperCase();

// Returns the promo document if this gym may use it for this plan, else throws a
// 400 with a message the owner can read. No side effects.
const checkPromo = async (code, { subscriberId, planKey, now = new Date() }) => {
  const c = normalize(code);
  if (!/^[A-Z0-9_-]{3,24}$/.test(c)) throw fail('That code does not look right.');
  const promo = await PromoCode.findOne({ code: c });
  if (!promo || !promo.isActive) throw fail('That code is not valid.');
  if (promo.expiresAt && promo.expiresAt < now) throw fail('That code has expired.');
  if (promo.maxRedemptions && promo.redeemedCount >= promo.maxRedemptions) throw fail('That code has been fully used.');
  if (promo.planKeys.length && !promo.planKeys.includes(planKey)) throw fail('That code does not work for this plan.');
  if (promo.firstPaymentOnly) {
    const paid = await SubscriptionPayment.exists({ subscriberId, status: 'paid' });
    if (paid) throw fail('That code is only for a first payment.');
  }
  return promo;
};

// Counts one use, once per payment. Safe to call from both confirm and webhook.
const redeemForPayment = async (payment) => {
  if (!payment.promoCode) return;
  const claimed = await SubscriptionPayment.findOneAndUpdate(
    { _id: payment._id, promoRedeemedAt: { $exists: false } },
    { $set: { promoRedeemedAt: new Date() } }
  );
  if (!claimed) return;
  await PromoCode.updateOne({ code: payment.promoCode }, { $inc: { redeemedCount: 1 } });
};

module.exports = { normalize, checkPromo, redeemForPayment };
