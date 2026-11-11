'use strict';
// Vehicles not seen for N days, and wash-due reminders by the vehicle's own interval. 'YYYY-MM-DD' dates. do-not-contact is never listed.
const DAY = 86400000;
const valid = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s + 'T00:00:00Z'));
const days = (a, b) => Math.round((Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / DAY);
const pickable = (v) => v && !v.doNotContact && valid(v.lastWash);
function lapsed(vehicles, today, minDays = 60) {
  return (vehicles || []).filter((v) => pickable(v) && days(v.lastWash, today) >= minDays).map((v) => ({ plate: v.plate, name: v.ownerName, daysAway: days(v.lastWash, today) })).sort((a, b) => b.daysAway - a.daysAway);
}
// Due for the next wash: past interval (default 14 days) plus grace. Skips vehicles with an active pass booking today or a job open.
function dueForWash(vehicles, today, defaultInterval = 14, grace = 1) {
  return (vehicles || []).filter((v) => pickable(v) && !v.openJob).map((v) => ({ v, every: Number.isInteger(v.intervalDays) ? v.intervalDays : defaultInterval }))
    .filter((x) => days(x.v.lastWash, today) >= x.every + grace)
    .map((x) => ({ plate: x.v.plate, name: x.v.ownerName, every: x.every, overdueDays: days(x.v.lastWash, today) - x.every })).sort((a, b) => b.overdueDays - a.overdueDays);
}
module.exports = { lapsed, dueForWash, days };
