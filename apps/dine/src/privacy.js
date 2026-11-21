'use strict';
// Data export and delete on request (DPDP), Phase 2 item 5. Pure shapes, same idea as Salon's privacy.js.
// "Delete" means anonymise: name, phone, birthday and visit dates are removed; bills and amounts stay because the accounts must add up
// (the lawyer confirms the exact retention rule, CA_LAWYER_ITEMS.md). Money the guest still owes blocks the delete until it is settled.
const CONFIRM_WORD = 'DELETE';
const int = (n) => Math.round(Number(n) || 0);
const confirmed = (body) => !!body && body.confirm === CONFIRM_WORD;
const tag = (id) => 'deleted-' + String(id);

// What we hold about ONE guest. No other guest's data.
function guestExport({ customer, orders = [], loyalty = [], credits = [] }) {
  return {
    schema: 1, kind: 'guest-export', currency: 'INR',
    guest: { name: customer.name, phone: customer.phone, birthday: customer.birthday || '', visits: customer.visits || [], doNotContact: customer.doNotContact === true },
    orders: orders.map((o) => ({ number: o.number, date: String(o.paidAt || o.createdAt || '').slice(0, 10), total: int(o.grandTotal), status: o.status, credit: int(o.credit) })),
    loyalty: loyalty.map((l) => ({ date: l.date, points: int(l.points), reason: l.reason })),
    credit: credits.map((c) => ({ order: c.orderNumber, date: c.date, amount: int(c.amount), paid: int(c.paid) })),
  };
}
const anonymisePatch = (id, now = new Date()) => ({ name: 'Deleted guest', phone: tag(id), birthday: '', visits: [], doNotContact: true, anonymised: true, erasedAt: now });
const owed = (credits) => (credits || []).filter((c) => !c.settled).reduce((a, c) => a + Math.max(0, int(c.amount) - int(c.paid)), 0);
const stripId = (o) => { const { _id, tenantId, __v, ...rest } = o; return rest; };
module.exports = { CONFIRM_WORD, confirmed, guestExport, anonymisePatch, owed, tag, stripId };
