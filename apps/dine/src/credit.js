'use strict';
// Pay-later (credit) for Dine, Phase 2 item 3. Pure: whole rupees, currency INR, no database, no clock.
// A credit row is { id, amount, paid, date }. Money paid against a customer's credit clears the OLDEST credit first.
const bad = (m) => { const e = new Error(m); e.code = 'CREDIT_INVALID'; throw e; };
const DEFAULT_LIMIT = 5000; // Assumption: Rs 5,000 per customer until the owner sets their own limit in settings.
const owing = (c) => Math.max(0, Math.round(c.amount || 0) - Math.round(c.paid || 0));
const outstanding = (credits) => (credits || []).reduce((a, c) => a + owing(c), 0);
const validPhone = (p) => /^[6-9]\d{9}$/.test(String(p || ''));
// Called before an order is saved as pay-later. Returns nothing; throws a plain message when it must be refused.
function checkNewCredit({ amount, phone, name, existing, limit = DEFAULT_LIMIT }) {
  if (!Number.isInteger(amount) || amount <= 0) bad('Pay-later amount must be a whole rupee amount above zero.');
  if (!validPhone(phone)) bad('Pay-later needs the customer\'s 10-digit mobile number.');
  if (String(name || '').trim().length < 2) bad('Pay-later needs the customer\'s name.');
  if (!Number.isInteger(limit) || limit < 0) bad('The credit limit is not valid.');
  if (outstanding(existing) + amount > limit) bad(`This customer already owes Rs ${outstanding(existing)}. The limit is Rs ${limit}.`);
}
// Splits a payment over the oldest credits first. Returns [{ id, apply }]. Paying more than is owed is refused.
function allocate(credits, amount) {
  if (!Number.isInteger(amount) || amount <= 0) bad('Payment must be a whole rupee amount above zero.');
  const open = (credits || []).filter((c) => owing(c) > 0).sort((a, b) => String(a.date).localeCompare(String(b.date)));
  if (amount > outstanding(open)) bad(`The customer owes only Rs ${outstanding(open)}.`);
  let left = amount; const out = [];
  for (const c of open) { if (left <= 0) break; const a = Math.min(left, owing(c)); out.push({ id: c.id, apply: a }); left -= a; }
  return out;
}
// Customers who owe, oldest unpaid first; days = age of the oldest unpaid credit.
function dues(credits, today) {
  const by = {};
  for (const c of credits || []) { if (owing(c) <= 0) continue; const b = by[c.phone] || (by[c.phone] = { phone: c.phone, name: c.name, owing: 0, oldest: c.date }); b.owing += owing(c); if (String(c.date) < String(b.oldest)) b.oldest = c.date; }
  return Object.values(by).map((b) => ({ ...b, days: Math.max(0, Math.round((Date.parse(today + 'T00:00:00Z') - Date.parse(b.oldest + 'T00:00:00Z')) / 86400000)), currency: 'INR' })).sort((a, b) => b.days - a.days);
}
module.exports = { DEFAULT_LIMIT, owing, outstanding, checkNewCredit, allocate, dues };
