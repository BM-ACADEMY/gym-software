'use strict';
// Leak checks: things that look wrong, for the owner to look at. They are questions, not accusations. Pure.
const int = (n) => Math.round(Number(n) || 0);
// Bills whose discount is a large share of the pre-discount amount (default 30 percent).
function heavyDiscounts(bills, pct = 30) {
  return bills.filter((b) => int(b.subtotal) > 0 && (int(b.discount) * 100) / int(b.subtotal) >= pct)
    .map((b) => ({ billNumber: b.number, date: b.date, discount: int(b.discount), subtotal: int(b.subtotal), percent: Math.round((int(b.discount) * 100) / int(b.subtotal)), reason: b.discountReason || '', currency: 'INR' }));
}
// Discounts given by staff (not the owner): the owner always sees them (D-30). Grouped per day.
function staffDiscounts(bills) {
  const by = {};
  for (const b of bills) if (b.discountBy === 'staff' && int(b.discount) > 0) { const d = by[b.date] || (by[b.date] = { date: b.date, count: 0, total: 0 }); d.count += 1; d.total += int(b.discount); }
  return Object.values(by).sort((a, b) => b.date.localeCompare(a.date)).map((d) => ({ ...d, currency: 'INR' }));
}
// Voided bills and refunds, for the owner to look at. Every one has a reason on it.
const voidedBills = (bills) => bills.filter((b) => b.status === 'void').map((b) => ({ billNumber: b.number, date: b.date, total: int(b.total), reason: b.voidReason || '', currency: 'INR' }));
const refundList = (returns) => (returns || []).map((r) => ({ number: r.number, billNumber: r.billNumber, date: r.date, amount: int(r.amount), reason: r.reason || '', method: r.method, currency: 'INR' }));
// Day-close differences that are not zero (tolerance in rupees, default 0).
const cashDifferences = (closes, tolerance = 0) => closes.filter((c) => Math.abs(int(c.difference)) > tolerance).map((c) => ({ date: c.date, difference: int(c.difference), currency: 'INR' }));
// Share of customers who came back: current period versus the one before. Flags a drop of 10+ points when both have 20+ customers.
function repeatDrop({ currentVisitors, currentReturning, previousVisitors, previousReturning }) {
  if (currentVisitors < 20 || previousVisitors < 20) return { enough: false };
  const cur = Math.round((currentReturning * 100) / currentVisitors), prev = Math.round((previousReturning * 100) / previousVisitors);
  return { enough: true, current: cur, previous: prev, flagged: prev - cur >= 10 };
}
// Builds the single list the owner sees, each line with what it means.
function leakList({ bills, closes, repeat, returns, pct = 30, tolerance = 0 }) {
  const out = [];
  for (const v of voidedBills(bills)) out.push({ kind: 'void', text: `Bill ${v.billNumber} (Rs ${v.total}) was voided on ${v.date}${v.reason ? `. Reason: ${v.reason}` : ''}.` });
  for (const r of refundList(returns)) out.push({ kind: 'refund', text: `Rs ${r.amount} was refunded on ${r.date} (${r.method})${r.reason ? `. Reason: ${r.reason}` : ''}.` });
  for (const d of heavyDiscounts(bills, pct)) out.push({ kind: 'discount', text: `Bill ${d.billNumber} on ${d.date} had a ${d.percent}% discount (Rs ${d.discount})${d.reason ? `. Reason given: ${d.reason}` : ''}.` });
  for (const d of staffDiscounts(bills)) out.push({ kind: 'staff_discount', text: `On ${d.date} staff gave ${d.count} discount${d.count === 1 ? '' : 's'} worth Rs ${d.total} in all. Each has a reason on its bill.` });
  for (const c of cashDifferences(closes, tolerance)) out.push({ kind: 'cash', text: `Cash on ${c.date} was ${c.difference < 0 ? 'short' : 'over'} by Rs ${Math.abs(c.difference)}.` });
  if (repeat && repeat.flagged) out.push({ kind: 'repeat', text: `Returning customers fell from ${repeat.previous}% to ${repeat.current}% of visitors.` });
  return out;
}
module.exports = { voidedBills, refundList, staffDiscounts, heavyDiscounts, cashDifferences, repeatDrop, leakList };
