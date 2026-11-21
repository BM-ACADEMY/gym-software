'use strict';
// Dates are 'YYYY-MM-DD' strings (shop's own calendar day, IST). No clock here: the caller passes "today".
const DAY = 86400000;
const valid = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s + 'T00:00:00Z'));
const days = (from, to) => Math.round((Date.parse(to + 'T00:00:00Z') - Date.parse(from + 'T00:00:00Z')) / DAY);
const addDays = (s, n) => new Date(Date.parse(s + 'T00:00:00Z') + n * DAY).toISOString().slice(0, 10);
// The shop's calendar day (IST) for a Date or ISO string.
const istDay = (d) => new Date(new Date(d).getTime() + 5.5 * 3600000).toISOString().slice(0, 10);
const int = (n) => Math.round(Number(n) || 0);
module.exports = { valid, days, addDays, istDay, int, DAY };
