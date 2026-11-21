'use strict';
// Reorder suggestions from how fast things sell and what is left on the shelf. A SUGGESTION: nothing is ordered for the owner.
// Rule (Assumption until real shops check it): average daily sales over the last `windowDays`, stock must cover
// `leadDays` (supplier delivery) plus `coverDays` of selling. `uplift` is a festival multiplier the owner sets (default 1).
const { valid, days, int } = require('./dates');

function suggestReorder({ items, sales, today, windowDays = 14, leadDays = 2, coverDays = 7, uplift = 1 }) {
  if (!valid(today)) return [];
  const up = Number.isFinite(uplift) && uplift > 0 && uplift <= 5 ? uplift : 1;
  const sold = {};
  for (const s of sales || []) {
    if (!s || !valid(s.date)) continue;
    const age = days(s.date, today);
    if (age < 0 || age >= windowDays) continue;
    sold[s.itemId] = (sold[s.itemId] || 0) + (Number(s.qty) > 0 ? Number(s.qty) : 0);
  }
  const out = [];
  for (const it of items || []) {
    if (!it || !it.trackStock || it.isActive === false) continue;
    const qty = Number(it.qty) || 0;
    const daily = (sold[it.id] || 0) / windowDays;
    const daysLeft = daily > 0 ? Math.round((qty / daily) * 10) / 10 : null;
    const need = Math.ceil(daily * up * (leadDays + coverDays));
    const order = Math.max(0, need - qty);
    const belowLevel = it.reorderLevel != null && qty <= it.reorderLevel;
    if (daily > 0 && order > 0) {
      out.push({ itemId: it.id, name: it.name, qty, daysLeft, orderQty: order, rupees: it.cost ? int(order * it.cost) : null, currency: 'INR',
        reason: `Sells about ${Math.round(daily * 10) / 10} a day, ${qty} left, enough for ${daysLeft} days. Order ${order} to cover ${leadDays + coverDays} days${up > 1 ? ' with the festival uplift' : ''}.` });
    } else if (belowLevel) {
      out.push({ itemId: it.id, name: it.name, qty, daysLeft, orderQty: Math.max(1, int(it.reorderLevel * 2 - qty)), rupees: null, currency: 'INR',
        reason: `${qty} left, at or below your reorder level of ${it.reorderLevel}. No recent sales to judge speed, so this follows your level.` });
    }
  }
  return out.sort((a, b) => (a.daysLeft === null) - (b.daysLeft === null) || (a.daysLeft || 0) - (b.daysLeft || 0));
}
module.exports = { suggestReorder };
