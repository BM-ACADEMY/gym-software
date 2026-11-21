'use strict';
// Who to call back. Dates are 'YYYY-MM-DD' strings. A customer marked do-not-contact is never listed.
const DAY = 86400000;
const days = (a, b) => Math.round((Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / DAY);
const valid = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s + 'T00:00:00Z'));

// Not seen for N days (default 60). Longest gap first.
function lapsed(customers, today, minDays = 60) {
  return (customers || []).filter((c) => c && !c.doNotContact && valid(c.lastVisit) && days(c.lastVisit, today) >= minDays)
    .map((c) => ({ id: c.id, name: c.name, daysAway: days(c.lastVisit, today) })).sort((a, b) => b.daysAway - a.daysAway);
}
// Past their usual gap for the last service (cycles: { haircut: 42 }). graceDays gives a little time before nudging.
// A service with no cycle (null) is never nudged. Someone already booked is skipped (c.nextBooking).
function dueForRebook(customers, today, cycles, graceDays = 3) {
  return (customers || []).filter((c) => {
    if (!c || c.doNotContact || c.nextBooking || !valid(c.lastVisit)) return false;
    const cyc = cycles && cycles[c.lastServiceKey];
    return Number.isInteger(cyc) && days(c.lastVisit, today) >= cyc + graceDays;
  }).map((c) => ({ id: c.id, name: c.name, serviceKey: c.lastServiceKey, overdueDays: days(c.lastVisit, today) - cycles[c.lastServiceKey] })).sort((a, b) => b.overdueDays - a.overdueDays);
}
module.exports = { lapsed, dueForRebook, days };
