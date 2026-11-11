'use strict';
// PAY-2: record a refund Razorpay has finished (refund.processed). The model is passed in so this runs without a database in tests.
// Whole rupees. Each refund id counts once. A full refund marks the payment refunded; the gym's plan is NOT ended automatically:
// refundNeedsReview tells a person to decide (refund window and plan end are Kamarudeen's call, M-16).
async function recordRefund(Payments, refund) {
  if (!refund || !refund.id || !refund.payment_id || !Number.isFinite(refund.amount) || refund.amount <= 0) return { ignored: true };
  const rupees = Math.round(refund.amount / 100);
  const p = await Payments.findOne({ razorpayPaymentId: refund.payment_id });
  if (!p) return { ignored: true, reason: 'payment not found' };
  if (p.refundIds.includes(refund.id)) return { handled: true, duplicate: true, status: p.status };
  const total = Math.min(p.total, p.refundedAmount + rupees);
  const full = total >= p.total - 1;
  const r = await Payments.updateOne({ _id: p._id, refundIds: { $ne: refund.id } },
    { $set: { refundedAmount: total, refundedAt: new Date(), refundNeedsReview: true, ...(full ? { status: 'refunded' } : {}) }, $push: { refundIds: refund.id } });
  return { handled: r.modifiedCount === 1, status: full ? 'refunded' : p.status, refundedAmount: total };
}
module.exports = { recordRefund };
