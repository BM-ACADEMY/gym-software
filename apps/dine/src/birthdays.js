'use strict';
// Birthday suggestions (Phase 2 item 7). Pure. We keep only month and day ("MM-DD"), never the year, to hold as little as possible.
// Suggest only: the owner reads the line and sends it themselves. A WhatsApp message by us needs an approved template (dine_birthday: not submitted).
const MMDD = /^(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
const validMmdd = (v) => MMDD.test(String(v || '')) && (() => { const [m, d] = v.split('-').map(Number); return d <= new Date(Date.UTC(2024, m, 0)).getUTCDate(); })();
const addDays = (date, n) => new Date(Date.parse(date + 'T00:00:00Z') + n * 86400000).toISOString().slice(0, 10);
// customers: [{ id, name, phone, birthday:'MM-DD', doNotContact, anonymised }]. today: 'YYYY-MM-DD'. Returns those with a birthday in the next `days` days (today included).
function birthdaysSoon(customers, today, days = 7) {
  const want = new Map(); for (let i = 0; i <= days; i += 1) want.set(addDays(today, i).slice(5), i);
  return (customers || []).filter((c) => c && !c.doNotContact && !c.anonymised && validMmdd(c.birthday) && want.has(c.birthday))
    .map((c) => ({ id: c.id, name: c.name, birthday: c.birthday, inDays: want.get(c.birthday) })).sort((a, b) => a.inDays - b.inDays);
}
const suggestion = (name, venue, offer) => `Happy birthday ${String(name || '').split(' ')[0] || ''}! ${venue ? 'From all of us at ' + venue + '. ' : ''}${offer ? offer + ' ' : ''}Hope to see you soon.`.replace(/\s+/g, ' ').trim();
module.exports = { validMmdd, birthdaysSoon, suggestion };
