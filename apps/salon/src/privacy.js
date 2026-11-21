'use strict';
// Data export and delete on request (DPDP). Pure shapes. "Delete" means anonymise: the person's name, phone, notes, dates
// and consent are removed; bills and amounts stay because accounts must add up (lawyer to confirm the exact retention rule).
const CONFIRM_WORD = 'DELETE';
const int = (n) => Math.round(Number(n) || 0);

// What we hold about one customer, for them or the owner. No other customer's data; no internal ids beyond the customer's own.
function customerExport({ customer, appointments = [], bills = [], loyalty = [], packages = [], notesIncluded = false }) {
  return {
    schema: 1, kind: 'customer-export', currency: 'INR',
    customer: { name: customer.name, phone: customer.phone, note: customer.note || '', birthday: customer.birthday || '', anniversary: customer.anniversary || '', doNotContact: customer.doNotContact === true, consent: customer.consent && customer.consent.at ? { at: customer.consent.at, source: customer.consent.source } : null, lastVisit: customer.lastVisit || '' },
    appointments: appointments.map((a) => ({ date: a.date, start: a.start, service: a.serviceName || a.serviceKey, status: a.status })),
    bills: bills.map((b) => ({ number: b.number, date: b.date, total: int(b.total), discount: int(b.discount), status: b.status || 'paid' })),
    loyalty: loyalty.map((l) => ({ at: l.createdAt, points: int(l.points), reason: l.reason })),
    packages: packages.map((p) => ({ name: p.name, total: int(p.total), used: int(p.used), expiresOn: p.expiresOn || '' })),
    clinicalNotesIncluded: notesIncluded,
  };
}
// The fields to set so the person cannot be identified. The phone must stay unique, so it becomes 'deleted-<id>'.
function anonymisePatch(id, now = new Date()) {
  return { name: 'Deleted customer', phone: 'deleted-' + String(id), note: '', birthday: '', anniversary: '', preferredStaffId: null, doNotContact: true, consent: null, anonymisedAt: now };
}
const confirmed = (body) => !!body && body.confirm === CONFIRM_WORD;
module.exports = { CONFIRM_WORD, customerExport, anonymisePatch, confirmed };
