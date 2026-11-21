'use strict';
// UPI payment link for the shop (area 4). We only BUILD the link from the owner's own UPI id; the customer pays in their own UPI
// app. We never see the money and cannot confirm it arrived: the owner checks the UPI app or bank and marks the link paid.
const VPA = /^[a-z0-9][a-z0-9._-]{1,63}@[a-z][a-z0-9]{1,31}$/i;
const clean = (s, n) => String(s == null ? '' : s).replace(/[^\p{L}\p{N} .,'-]/gu, '').trim().slice(0, n);
const validVpa = (v) => typeof v === 'string' && VPA.test(v.trim());
// Returns { link } or { error }. Amount is whole rupees (Rs 1 to 1,00,000: a UPI app limit that may differ by bank, Assumption).
function buildLink({ vpa, payeeName, amount, note }) {
  if (!validVpa(vpa)) return { error: 'Set your UPI id in settings first (for example shopname@bank).' };
  const a = Number(amount); if (!Number.isInteger(a) || a < 1 || a > 100000) return { error: 'Enter the amount in whole rupees, from 1 to 1,00,000.' };
  const q = [['pa', vpa.trim()], ['pn', clean(payeeName, 40) || 'Shop'], ['am', String(a)], ['cu', 'INR']]; const tn = clean(note, 40); if (tn) q.push(['tn', tn]);
  return { link: 'upi://pay?' + q.map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&'), amount: a, currency: 'INR' };
}
module.exports = { validVpa, buildLink, clean };
