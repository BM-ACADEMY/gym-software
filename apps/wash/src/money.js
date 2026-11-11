'use strict';
// Customer dues (pay later) and refunds for wash jobs. Whole rupees, INR. Pure; routes do the saving.
const METHODS = ['cash', 'upi', 'card'];
const isInt = (n) => Number.isInteger(n);
const sumOf = (pays) => (pays || []).reduce((s, p) => s + (p.amount || 0), 0);

// Delivery with some or none paid now. payLater must be asked for; the rest is recorded as a due.
// Returns { due } or { error }.
function dueAfterDelivery({ owe, pays, payLater, hasPhone }) {
  const paid = sumOf(pays);
  if (paid === owe) return { due: 0 };
  if (!payLater) return { error: 'Payments must add up to Rs ' + owe };
  if (paid > owe) return { error: 'Payments are more than the bill' };
  if (!hasPhone) return { error: 'Add the owner\'s phone number to the vehicle first, so the due can be followed up' };
  return { due: owe - paid };
}
// Collecting a due later: each payment is cash, upi or card; the total cannot be more than what is still due.
function checkCollection({ due, pays }) {
  if (!isInt(due) || due < 1) return { error: 'Nothing is due on this job' };
  if (!Array.isArray(pays) || !pays.length || pays.length > 3 || pays.some((p) => !p || !METHODS.includes(p.method) || !isInt(p.amount) || p.amount < 1)) return { error: 'Each payment needs cash, upi or card and a whole-rupee amount' };
  const s = sumOf(pays); if (s > due) return { error: 'That is more than the Rs ' + due + ' still due' };
  return { collected: s, left: due - s };
}
// A refund on a delivered job: up to what was actually paid, minus refunds already given. A reason is always required.
function checkRefund({ job, amount, method, reason }) {
  if (!job || job.state !== 'delivered') return { error: 'Only a delivered job can be refunded' };
  if (!METHODS.includes(method)) return { error: 'Choose cash, upi or card' };
  const why = typeof reason === 'string' ? reason.trim().slice(0, 120) : '';
  if (why.length < 3) return { error: 'Write the reason for the refund' };
  const paid = sumOf(job.payments) + (job.collected || 0);
  const room = paid - (job.refunded || 0);
  if (!isInt(amount) || amount < 1) return { error: 'The refund is a whole-rupee amount' };
  if (amount > room) return { error: 'You can refund at most Rs ' + Math.max(0, room) + ' on this job' };
  return { value: { amount, method, reason: why } };
}
module.exports = { METHODS, sumOf, dueAfterDelivery, checkCollection, checkRefund };
