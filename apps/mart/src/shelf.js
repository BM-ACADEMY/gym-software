'use strict';
// Expiry and dead stock. Discount steps are Assumptions (owner edits them): 30% within 7 days, 20% within 15, 10% within 30.
const { valid, days, int, istDay } = require('./dates');
const STEPS = [[7, 30], [15, 20], [30, 10]];
const worth = (it) => int((Number(it.qty) || 0) * (it.cost || it.price || 0));

function expiryList(items, today, within = 30, steps = STEPS) {
  if (!valid(today)) return [];
  const out = [];
  for (const it of items || []) {
    if (!it || !it.expiresAt || !(Number(it.qty) > 0)) continue;
    const left = days(today, istDay(it.expiresAt));
    if (left > within) continue;
    const step = steps.find(([d]) => left <= d);
    const expired = left < 0;
    out.push({ itemId: it.id, name: it.name, qty: it.qty, daysLeft: left, expired, suggestedDiscountPct: expired ? 0 : step ? step[1] : 0, rupees: worth(it), currency: 'INR',
      reason: expired ? `Expired ${-left} day(s) ago. Take it off the shelf; ${worth(it)} rupees of stock.` : `Expires in ${left} day(s), ${it.qty} in stock worth about ${worth(it)} rupees. A ${step ? step[1] : 0}% offer now sells more than it loses.` });
  }
  return out.sort((a, b) => a.daysLeft - b.daysLeft);
}
// In stock, never sold in the last `quiet` days.
function deadStock(items, sales, today, quiet = 45) {
  if (!valid(today)) return [];
  const last = {};
  for (const s of sales || []) if (s && valid(s.date) && (!last[s.itemId] || s.date > last[s.itemId])) last[s.itemId] = s.date;
  return (items || []).filter((it) => it && it.trackStock && it.isActive !== false && Number(it.qty) > 0 && !(last[it.id] && days(last[it.id], today) < quiet))
    .map((it) => ({ itemId: it.id, name: it.name, qty: it.qty, rupees: worth(it), currency: 'INR', reason: `Not sold in ${quiet} days. ${worth(it)} rupees of cash is sitting on the shelf.` }))
    .sort((a, b) => b.rupees - a.rupees);
}
module.exports = { expiryList, deadStock, STEPS };
