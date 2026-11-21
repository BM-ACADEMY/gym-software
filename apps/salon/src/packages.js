'use strict';
// Packages and memberships ("physio session 4 of 10"). Pure helpers; the route keeps `left` as a counter that only
// moves down through one guarded update, so two people tapping "use a session" cannot spend the last one twice.
const int = (n) => Math.round(Number(n) || 0);

function validate({ name, total, price, expiresOn }, validDate) {
  const n = String(name || '').trim().slice(0, 80); if (n.length < 2) return { error: 'Give the package a name.' };
  const t = int(total); if (!Number.isInteger(Number(total)) || t < 1 || t > 200) return { error: 'Number of sessions must be a whole number from 1 to 200.' };
  const p = int(price); if (p < 0 || p > 10000000) return { error: 'Price must be whole rupees.' };
  if (expiresOn && !validDate(expiresOn)) return { error: 'Pick a valid expiry date.' };
  return { value: { name: n, total: t, left: t, price: p, currency: 'INR', expiresOn: expiresOn || undefined } };
}
const expired = (pkg, today) => !!pkg.expiresOn && pkg.expiresOn < today;
// "Session 4 of 10" is the one about to be used; "Finished" when none are left.
function describe(pkg, today) {
  const total = int(pkg.total), left = int(pkg.left), used = total - left;
  const status = pkg.active === false ? 'closed' : left <= 0 ? 'finished' : expired(pkg, today) ? 'expired' : 'open';
  return { id: pkg.id || String(pkg._id), name: pkg.name, total, left, used, status, text: left <= 0 ? `All ${total} sessions used.` : `${used} of ${total} used, ${left} left.`, expiresOn: pkg.expiresOn || '' };
}
module.exports = { validate, expired, describe };
