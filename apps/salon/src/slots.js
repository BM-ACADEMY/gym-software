'use strict';
// Free appointment times for one staff member on one day. Times are whole minutes from midnight (600 = 10:00).
// Pure: no clock, no database. The caller passes "now" (minutes) only when the day is today.
const overlaps = (aStart, aEnd, bStart, bEnd) => aStart < bEnd && bStart < aEnd;
const isInt = (n) => Number.isInteger(n);

// windows: [[600,780],[1080,1260]] working hours. booked: [{start,end}] existing visits of THIS staff member.
// Returns start times where [start, start+mins+buffer) fits inside a window and clashes with nothing.
function freeSlots({ windows, booked = [], mins, step = 30, buffer = 0, notBefore = 0 }) {
  if (!Array.isArray(windows) || !isInt(mins) || mins < 5 || !isInt(step) || step < 5 || !isInt(buffer) || buffer < 0) return [];
  const out = [];
  for (const w of windows) {
    if (!Array.isArray(w) || !isInt(w[0]) || !isInt(w[1]) || w[1] <= w[0]) continue;
    for (let s = w[0]; s + mins <= w[1]; s += step) {
      if (s < notBefore) continue;
      const e = s + mins + buffer;
      if (booked.some((b) => overlaps(s, e, b.start, b.end))) continue;
      out.push(s);
    }
  }
  return out;
}
// Would a new visit clash with what is already booked? Used again at save time, so two people tapping the same slot
// cannot both win (the database also keeps a unique index on staff + date + start).
const hasClash = (start, mins, booked, buffer = 0) => booked.some((b) => overlaps(start, start + mins + buffer, b.start, b.end));
const hhmm = (m) => String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0');
module.exports = { freeSlots, hasClash, overlaps, hhmm };
