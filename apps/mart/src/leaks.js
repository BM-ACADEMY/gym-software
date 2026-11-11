'use strict';
// Leak checks: things that look wrong, shown to the owner as questions, never as accusations.
const { int } = require('./dates');

// Bills where the discount is a large share of the pre-discount total.
function heavyDiscounts(bills, { pct = 20, minRupees = 100 } = {}) {
  return (bills || []).filter((b) => b && b.subtotal > 0 && b.discount >= minRupees && (b.discount * 100) / b.subtotal >= pct)
    .map((b) => ({ billId: b.id, number: b.number, by: b.by || null, pct: Math.round((b.discount * 100) / b.subtotal), rupees: int(b.discount), currency: 'INR',
      reason: `Bill ${b.number}: ${int(b.discount)} rupees off a ${int(b.subtotal)} rupee bill (${Math.round((b.discount * 100) / b.subtotal)}%).` }))
    .sort((a, b) => b.rupees - a.rupees);
}
// Staff with many fully returned bills in the period.
function returnsByStaff(bills, { minCount = 3 } = {}) {
  const g = {};
  for (const b of bills || []) if (b && b.status === 'returned') { const k = b.by || 'unknown'; g[k] = g[k] || { by: k, count: 0, rupees: 0 }; g[k].count += 1; g[k].rupees += int(b.total); }
  return Object.values(g).filter((x) => x.count >= minCount).sort((a, b) => b.rupees - a.rupees)
    .map((x) => ({ ...x, currency: 'INR', reason: `${x.count} bills returned in full, ${x.rupees} rupees. Worth a look.` }));
}
// Stock count vs system. counts: [{ itemId, name, system, counted, cost }]. Short = fewer on the shelf than the system says.
function stockMismatch(counts, { minRupees = 50 } = {}) {
  return (counts || []).filter((c) => c && Number.isFinite(c.system) && Number.isFinite(c.counted) && c.counted !== c.system)
    .map((c) => { const diff = c.counted - c.system; return { itemId: c.itemId, name: c.name, diff, rupees: int(Math.abs(diff) * (c.cost || 0)), currency: 'INR', kind: diff < 0 ? 'short' : 'extra',
      reason: diff < 0 ? `${-diff} fewer than the system says (${c.system}).` : `${diff} more than the system says (${c.system}). Was a purchase left out?` }; })
    .filter((x) => x.rupees >= minRupees).sort((a, b) => b.rupees - a.rupees);
}
// Day-end cash: expected = opening + cash sales - cash paid out.
const cashMismatch = ({ expected, counted }) => { const diff = int(counted) - int(expected); return { diff, rupees: Math.abs(diff), currency: 'INR', ok: diff === 0, kind: diff < 0 ? 'short' : diff > 0 ? 'extra' : 'match' }; };
module.exports = { heavyDiscounts, returnsByStaff, stockMismatch, cashMismatch };
