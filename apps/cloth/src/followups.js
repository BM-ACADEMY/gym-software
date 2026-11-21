'use strict';
// Customer lists for the owner. A customer with doNotContact is never listed.
// customers: [{ id,name,lastVisit,creditDue,creditSince,occasionOn('MM-DD'|null),doNotContact }]
const DAY = 86400000; const d = (s) => Date.parse(s + 'T00:00:00Z');
const diff = (a, b) => Math.round((d(b) - d(a)) / DAY);
function lists(customers, today, { lapsedDays = 90, creditDays = 30, occasionWithin = 7 } = {}) {
  const ok = (customers || []).filter((c) => c && !c.doNotContact);
  const md = (s) => s.slice(5);
  const y = today.slice(0, 4);
  const occ = (c) => { if (!c.occasionOn) return null; let t = `${y}-${c.occasionOn}`; if (t < today) t = `${Number(y) + 1}-${c.occasionOn}`; const n = diff(today, t); return n <= occasionWithin ? n : null; };
  return {
    lapsed: ok.filter((c) => c.lastVisit && diff(c.lastVisit, today) >= lapsedDays).map((c) => ({ id: c.id, name: c.name, daysAway: diff(c.lastVisit, today) })).sort((a, b) => b.daysAway - a.daysAway),
    creditOverdue: ok.filter((c) => c.creditDue > 0 && c.creditSince && diff(c.creditSince, today) >= creditDays).map((c) => ({ id: c.id, name: c.name, due: c.creditDue, days: diff(c.creditSince, today), currency: 'INR' })).sort((a, b) => b.due - a.due),
    occasions: ok.map((c) => ({ c, n: occ(c) })).filter((x) => x.n !== null).map((x) => ({ id: x.c.id, name: x.c.name, inDays: x.n })).sort((a, b) => a.inDays - b.inDays),
  };
}
module.exports = { lists, diff };
