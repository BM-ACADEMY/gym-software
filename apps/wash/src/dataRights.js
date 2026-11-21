'use strict';
// Export and delete on request (DPDP style rights). Pure helpers; the routes do the reading and writing.
//  - EXPORT: the owner downloads everything the business holds in one JSON file (vehicles, jobs, passes, expenses, cash closings,
//    attendants, attendance, shifts, refunds, collections, bookings, photo references). No passwords, no other business's data.
//  - ANONYMISE a customer: owner name and phone are wiped from the vehicle and from waiting booking requests; the plate and the
//    money records stay (accounts must still add up). The retention period for accounts is a lawyer/CA question.
//  - DELETE the whole account: a REQUEST that is recorded and audited. Afra deletes after a waiting period; nothing is erased by one tap.
const CONFIRM_TEXT = 'DELETE MY DATA';
const WAIT_DAYS = 30; // Assumption: lawyer to confirm the period
const KEYS = ['vehicles', 'jobs', 'passes', 'expenses', 'cashClosings', 'attendants', 'attendance', 'shifts', 'refunds', 'collections', 'bookings', 'photos', 'priceList'];
const strip = (o) => { if (!o) return o; const { passwordHash, __v, ...rest } = o; return rest; };
function shapeExport({ tenant, data, now }) {
  const out = { schema: 1, product: 'wash', exportedAt: now.toISOString(), currency: 'INR', business: tenant ? { name: tenant.businessName, state: tenant.state || null } : null };
  for (const k of KEYS) out[k] = k === 'priceList' ? (data[k] ? strip(data[k]) : null) : (Array.isArray(data[k]) ? data[k].map(strip) : []);
  return out;
}
const checkDeleteRequest = (b) => (b && b.confirm === CONFIRM_TEXT ? { ok: true } : { error: 'To confirm, send the words ' + CONFIRM_TEXT });
module.exports = { CONFIRM_TEXT, WAIT_DAYS, KEYS, shapeExport, checkDeleteRequest };
