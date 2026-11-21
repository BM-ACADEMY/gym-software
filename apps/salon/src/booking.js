'use strict';
// Booking rules that need no database. Dates are 'YYYY-MM-DD' in India time (IST); times are minutes from midnight.
const { freeSlots, hasClash } = require('./slots');
const IST_MS = 5.5 * 3600000; const MAX_DAYS_AHEAD = 60;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const validDate = (s) => typeof s === 'string' && DATE.test(s) && !Number.isNaN(Date.parse(s + 'T00:00:00Z')) && new Date(s + 'T00:00:00Z').toISOString().slice(0, 10) === s;
const istParts = (now = new Date()) => { const d = new Date(now.getTime() + IST_MS); return { date: d.toISOString().slice(0, 10), minutes: d.getUTCHours() * 60 + d.getUTCMinutes() }; };
const weekday = (date) => new Date(date + 'T00:00:00Z').getUTCDay();
const daysBetween = (a, b) => Math.round((Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / 86400000);
const addDays = (date, n) => new Date(Date.parse(date + 'T00:00:00Z') + n * 86400000).toISOString().slice(0, 10);
const err = (code, message) => Object.assign(new Error(message), { code });

// Is this date open for booking at all? Throws a BOOKING_* error with a plain message.
function checkDay(tenant, date, now = new Date()) {
  if (!validDate(date)) throw err('BOOKING_DATE', 'Pick a valid date.');
  const t = istParts(now);
  const ahead = daysBetween(t.date, date);
  if (ahead < 0) throw err('BOOKING_PAST', 'That date has passed.');
  if (ahead > MAX_DAYS_AHEAD) throw err('BOOKING_FAR', `Bookings open up to ${MAX_DAYS_AHEAD} days ahead.`);
  if ((tenant.closedWeekdays || []).includes(weekday(date))) throw err('BOOKING_CLOSED', 'Closed on that day.');
  return t;
}
// Free start times for one staff member on one date. booked: that staff member's active visits that day.
function slotsFor({ tenant, date, mins, booked, now = new Date() }) {
  const t = checkDay(tenant, date, now);
  return freeSlots({ windows: tenant.windows || [], booked, mins, step: tenant.slotStep || 30, buffer: tenant.bufferMins || 0, notBefore: date === t.date ? t.minutes : 0 });
}
// The final check at save time. publicBooking: the time must be one of the offered slots. Owner may pick any time inside working hours.
function checkStart({ tenant, date, start, mins, booked, publicBooking, now = new Date() }) {
  if (!Number.isInteger(start) || start < 0 || start + mins > 1440) throw err('BOOKING_TIME', 'Pick a valid time.');
  if (publicBooking) { if (!slotsFor({ tenant, date, mins, booked, now }).includes(start)) throw err('BOOKING_TAKEN', 'That time is no longer free. Please pick another.'); return; }
  const t = checkDay(tenant, date, now);
  if (date === t.date && start < t.minutes - 60) throw err('BOOKING_PAST', 'That time has passed.');
  if (!(tenant.windows || []).some((w) => start >= w[0] && start + mins <= w[1])) throw err('BOOKING_HOURS', 'That time is outside working hours.');
  if (hasClash(start, mins, booked, tenant.bufferMins || 0)) throw err('BOOKING_TAKEN', 'That staff member already has a visit then.');
}
const PHONE = /^[6-9]\d{9}$/;
const cleanPhone = (p) => { const d = String(p || '').replace(/\D/g, ''); return d.length === 12 && d.startsWith('91') ? d.slice(2) : d; };
const validPhone = (p) => PHONE.test(cleanPhone(p));
const maskPhone = (p) => (p ? String(p).slice(0, 2) + '******' + String(p).slice(-2) : null);
module.exports = { validDate, istParts, weekday, daysBetween, addDays, checkDay, slotsFor, checkStart, cleanPhone, validPhone, maskPhone, MAX_DAYS_AHEAD };
