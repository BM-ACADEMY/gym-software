'use strict';
// Data export and delete on request (DPDP-style rights; wording needs the lawyer, see docs/products/mart/BUILD_NOTES.md). Pure helpers.
// Delete means ANONYMISE: the person's name, phone, email and note are removed. The shop's bills and money records stay,
// because the shop must keep its accounts. Nothing here deletes a whole shop; that is a request a person at Afra handles.
const CONFIRM_SHOP = 'DELETE MY SHOP';
const pick = (o, keys) => Object.fromEntries(keys.filter((k) => o[k] !== undefined).map((k) => [k, o[k]]));

// What one customer is told about themselves. No internal ids, no other customers.
function customerExport({ customer, bills, payments }) {
  return {
    customer: pick(customer, ['name', 'phone', 'email', 'note', 'creditDue', 'currency']),
    bills: (bills || []).map((b) => pick(b, ['number', 'total', 'credit', 'status', 'createdAt', 'currency'])),
    paymentsAgainstUdhaar: (payments || []).map((p) => pick(p, ['day', 'amount', 'method', 'currency'])),
    note: 'This is what this shop holds about you. The shop keeps its bills for its accounts.',
  };
}
// The update that anonymises a customer. creditDue is kept (the shop may still be owed money).
const anonymiseSet = (now) => ({ name: 'Deleted customer', phone: null, email: null, note: '', isActive: false, deletedAt: now });
const anonymiseUnset = { phone: 1, email: 1 };
const shopDeleteOk = (text) => text === CONFIRM_SHOP;
module.exports = { CONFIRM_SHOP, customerExport, anonymiseSet, anonymiseUnset, shopDeleteOk };
