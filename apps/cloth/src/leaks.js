'use strict';
// Leak checks: things that look wrong, shown for the owner to look at. They are hints, not accusations.
// bills: [{id,number,total,discount,status,by,date}] (discount in whole rupees; total after discount).
function heavyDiscounts(bills, pct = 25) {
  return (bills || []).filter((b) => b && b.discount > 0 && b.total + b.discount > 0 && (b.discount * 100) / (b.total + b.discount) >= pct)
    .map((b) => ({ id: b.id, number: b.number, by: b.by, discountPct: Math.round((b.discount * 100) / (b.total + b.discount)), reason: `Discount was ${Math.round((b.discount * 100) / (b.total + b.discount))}% of the bill value.` }));
}
// A staff member whose returned/void bills are well above the shop's norm (needs 5+ bills of theirs and 2x the shop rate, min 3 voids).
function voidsByStaff(bills) {
  const per = {}; let all = 0, allVoid = 0;
  for (const b of bills || []) { if (!b.by) continue; const p = per[b.by] = per[b.by] || { n: 0, v: 0 }; p.n++; all++; if (b.status === 'returned') { p.v++; allVoid++; } }
  const rate = all ? allVoid / all : 0;
  return Object.entries(per).filter(([, p]) => p.n >= 5 && p.v >= 3 && p.v / p.n >= Math.max(0.1, rate * 2)).map(([by, p]) => ({ by, bills: p.n, voided: p.v, reason: `${p.v} of ${p.n} bills returned or cancelled (shop average ${Math.round(rate * 100)}%).` }));
}
// closes: [{date,difference}] day-close history. Flags a run of short days.
function cashDifferences(closes) {
  const shorts = (closes || []).filter((c) => c.difference < 0);
  const total = shorts.reduce((a, c) => a + c.difference, 0);
  return shorts.length >= 3 ? [{ days: shorts.length, total, reason: `Cash was short on ${shorts.length} days, Rs ${-total} in all.` }] : [];
}
// D-30: discounts given by staff (not the owner), grouped per day, for the owner to see. rows: [{date,discount,by}]
function staffDiscounts(rows) {
  const by = {};
  for (const r of rows || []) if (r.by === 'staff' && r.discount > 0) { const d = by[r.date] || (by[r.date] = { date: r.date, count: 0, total: 0 }); d.count++; d.total += r.discount; }
  return Object.values(by).sort((a, b) => (a.date < b.date ? 1 : -1)).map((d) => ({ ...d, currency: 'INR', reason: `Staff gave ${d.count} discount${d.count === 1 ? '' : 's'} worth Rs ${d.total} on ${d.date}.` }));
}
module.exports = { staffDiscounts, heavyDiscounts, voidsByStaff, cashDifferences };
