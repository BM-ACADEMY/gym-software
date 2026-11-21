'use strict';
// Voids and refunds on bills. Pure rules; the route does the guarded writes. Whole rupees, INR.
// A void cancels the whole bill (a mistake). A refund gives money back on a bill that stands (a return).
// Both need a reason, both are the owner's call, both are audited and shown in the owner's alert list.
const int = (n) => Math.round(Number(n) || 0);
const METHODS = ['cash', 'upi', 'card', 'bank'];
const REASON_MIN = 3;

function checkVoid({ bill, reason }) {
  if (!bill) return { error: 'Bill not found.' };
  if (bill.status === 'void') return { error: 'This bill is already voided.' };
  if (int(bill.refunded) > 0) return { error: 'This bill already has a refund. A bill with a refund cannot be voided.' };
  const r = String(reason || '').trim().slice(0, 120); if (r.length < REASON_MIN) return { error: 'A void needs a reason.' };
  return { value: { reason: r } };
}
// The part of a bill that can still be given back: only what the customer actually paid (not what is still owed).
const paidOf = (bill) => Math.max(0, int(bill.total) - int(bill.due));
const refundable = (bill) => Math.max(0, paidOf(bill) - int(bill.refunded));
function checkRefund({ bill, amount, method, reason }) {
  if (!bill) return { error: 'Bill not found.' };
  if (bill.status === 'void') return { error: 'A voided bill cannot be refunded.' };
  const a = Number(amount); if (!Number.isInteger(a) || a < 1) return { error: 'Enter the refund in whole rupees.' };
  if (a > refundable(bill)) return { error: `At most Rs ${refundable(bill)} can still be refunded on this bill.` };
  if (!METHODS.includes(method)) return { error: 'Choose how the money goes back: cash, UPI, card or bank.' };
  const r = String(reason || '').trim().slice(0, 120); if (r.length < REASON_MIN) return { error: 'A refund needs a reason.' };
  // The refund is split into the sale part and the GST part in the same share as the bill, so the accounts and GST stay right.
  const total = int(bill.total); const taxable = total > 0 ? Math.round((a * int(bill.taxable)) / total) : a; const gst = Math.max(0, a - taxable);
  return { value: { amount: a, taxable, gst, method, reason: r, currency: 'INR' } };
}
module.exports = { paidOf, METHODS, checkVoid, refundable, checkRefund };
