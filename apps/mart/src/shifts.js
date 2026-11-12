'use strict';
// Staff shifts: a planned start and end on one day (HH:MM, 24 hour, same day, so a night shift that crosses midnight is entered as two shifts).
// Pure: no database, no clock. Used by the shift routes.
const TIME = /^([01]\d|2[0-3]):([0-5]\d)$/;
const mins = (t) => { const m = TIME.exec(String(t)); return m ? Number(m[1]) * 60 + Number(m[2]) : null; };
function check({ start, end }) {
  const a = mins(start); const b = mins(end);
  if (a === null || b === null) return { error: 'Enter the times as 24 hour HH:MM, for example 09:00 and 18:00.' };
  if (b <= a) return { error: 'The end must be after the start on the same day. For a night shift, enter two shifts.' };
  if (b - a > 16 * 60) return { error: 'A shift cannot be longer than 16 hours.' };
  return { minutes: b - a };
}
// existing: [{ _id, start, end }] for the same person and day. Touching (one ends 14:00, next starts 14:00) is allowed.
const overlaps = (existing, { start, end }) => (existing || []).some((s) => mins(s.start) < mins(end) && mins(start) < mins(s.end));
const hours = (minutes) => Math.round((minutes / 60) * 100) / 100;
// rows: [{ staffId, start, end }] -> { staffId: hours }
function totals(rows) { const t = {}; for (const r of rows || []) { const c = check(r); if (!c.error) t[String(r.staffId)] = (t[String(r.staffId)] || 0) + c.minutes; } return Object.fromEntries(Object.entries(t).map(([k, v]) => [k, hours(v)])); }
module.exports = { mins, check, overlaps, hours, totals };
