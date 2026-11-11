'use strict';
// D-30: who may give a discount. The owner sets this in Settings; the default lets staff give up to 10 percent.
// rule: { staff: 'any' | 'limit' | 'owner_only', maxPercent: 0..100 }. The owner is never limited. Pure.
const DEFAULT_RULE = { staff: 'limit', maxPercent: 10 };
function normalize(r) {
  const staff = r && ['any', 'limit', 'owner_only'].includes(r.staff) ? r.staff : DEFAULT_RULE.staff;
  const p = r && Number.isInteger(r.maxPercent) && r.maxPercent >= 0 && r.maxPercent <= 100 ? r.maxPercent : DEFAULT_RULE.maxPercent;
  return { staff, maxPercent: p };
}
const percentOf = (discount, subtotal) => (subtotal > 0 ? Math.round((discount * 100) / subtotal) : 0);
// role: 'admin' (owner) or 'staff'. Returns { ok, percent, message? }.
function check({ role, discount, subtotal, rule }) {
  const percent = percentOf(Math.round(Number(discount) || 0), Math.round(Number(subtotal) || 0));
  if (!discount || role !== 'staff') return { ok: true, percent };
  const r = normalize(rule);
  if (r.staff === 'any') return { ok: true, percent };
  if (r.staff === 'owner_only') return { ok: false, percent, message: 'Only the owner can give a discount. Ask the owner to change the bill.' };
  // Compare the exact share, not the rounded one, so 10.4 percent does not slip through a 10 percent limit.
  if (discount * 100 > subtotal * r.maxPercent) return { ok: false, percent, message: `Staff can give a discount up to ${r.maxPercent}%. Ask the owner for a bigger one.` };
  return { ok: true, percent };
}
module.exports = { DEFAULT_RULE, normalize, check, percentOf };
