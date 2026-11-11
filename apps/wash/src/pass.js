'use strict';
// Monthly pass: N washes for one vehicle between two dates. Dates are 'YYYY-MM-DD'. Pure.
const DAY = 86400000;
const t = (s) => Date.parse(s + 'T00:00:00Z');
const err = (code, message) => Object.assign(new Error(message), { code });
const addDays = (s, n) => new Date(t(s) + n * DAY).toISOString().slice(0, 10);

function newPass({ plate, washes, startsOn, validDays = 30, price }) {
  if (!Number.isInteger(washes) || washes < 1 || washes > 100) throw err('PASS_INVALID', 'Washes must be 1 to 100');
  if (!Number.isInteger(price) || price < 0) throw err('PASS_INVALID', 'Price must be whole rupees');
  return { plate, washes, used: 0, startsOn, endsOn: addDays(startsOn, validDays - 1), price, currency: 'INR' };
}
// status on a given day: left, expired, notStarted, and whether to remind (expires within 5 days or 1 wash left).
function status(pass, today) {
  const left = pass.washes - pass.used;
  const expired = t(today) > t(pass.endsOn);
  const notStarted = t(today) < t(pass.startsOn);
  const daysLeft = Math.max(0, Math.round((t(pass.endsOn) - t(today)) / DAY) + 1);
  return { left, expired, notStarted, daysLeft, usable: !expired && !notStarted && left > 0, remind: !expired && (left <= 1 || daysLeft <= 5) };
}
function useWash(pass, today) {
  const s = status(pass, today);
  if (s.expired) throw err('PASS_EXPIRED', 'This pass has expired');
  if (s.notStarted) throw err('PASS_NOT_STARTED', 'This pass has not started');
  if (s.left < 1) throw err('PASS_EMPTY', 'No washes left on this pass');
  return { ...pass, used: pass.used + 1 };
}
// Hand a wash back (job cancelled after the pass was used). Never below zero.
const refundWash = (pass) => ({ ...pass, used: Math.max(0, pass.used - 1) });
module.exports = { newPass, status, useWash, refundWash, addDays };
