'use strict';
// Pub / bar mode rules. Pure. Nothing here produces an excise register or report, and nothing promises compliance:
// state rules differ and are a CA / lawyer item (docs/products/dine/CA_LAWYER_ITEMS.md). These are the owner's own stock checks and prices.
const bad = (m) => { const e = new Error(m); e.code = 'PUB_INVALID'; throw e; };

// Sold ml for a drink line: measure in ml per serve (a peg is whatever the owner sets, e.g. 30 or 60) times quantity.
const soldMl = (lines) => lines.reduce((a, l) => a + (Number(l.measureMl) || 0) * l.qty, 0);
// Sold versus opened. All numbers in ml for ONE bottle product. A shortfall means less in the bottle than the sales explain.
// tolerancePct default 2 (Assumption: spillage and sampling; owner can change).
function bottleVariance({ openingMl, receivedMl = 0, soldMl: sold, closingMl, tolerancePct = 2 }) {
  for (const v of [openingMl, receivedMl, sold, closingMl]) if (!Number.isFinite(v) || v < 0) bad('Stock figures must be zero or more.');
  const expected = openingMl + receivedMl - sold;
  const variance = closingMl - expected; // negative = missing
  const base = openingMl + receivedMl;
  const pct = base > 0 ? Math.round((Math.abs(variance) / base) * 1000) / 10 : 0;
  return { expectedMl: expected, varianceMl: variance, variancePercent: pct, flag: base > 0 && pct > tolerancePct ? (variance < 0 ? 'short' : 'over') : 'ok' };
}
// Time-based pricing. rule: { label, days: [0..6] (0 = Sunday), from: 'HH:MM', to: 'HH:MM', type: 'percent_off'|'amount_off', value, appliesTo?: [itemKey] }.
// A window like 22:00 to 02:00 runs past midnight and counts for the day it STARTED on. `at` = { day, minutes } in local time (the caller converts from IST).
const mins = (s) => { const m = /^(\d{2}):(\d{2})$/.exec(s || ''); if (!m || +m[1] > 23 || +m[2] > 59) bad('Time must be HH:MM.'); return +m[1] * 60 + +m[2]; };
function ruleActive(rule, at) {
  const from = mins(rule.from); const to = mins(rule.to); const prev = (at.day + 6) % 7;
  if (from === to) bad('A pricing window cannot start and end at the same time.');
  if (from < to) return rule.days.includes(at.day) && at.minutes >= from && at.minutes < to;
  return (rule.days.includes(at.day) && at.minutes >= from) || (rule.days.includes(prev) && at.minutes < to);
}
// Price after the best active rule for this item (the biggest saving, never below zero). Returns { price, rule } so the bill shows WHY.
function priceNow(item, rules, at) {
  let best = { price: item.price, rule: null };
  for (const r of rules || []) {
    if (r.appliesTo && !r.appliesTo.includes(item.key)) continue;
    if (!ruleActive(r, at)) continue;
    const off = r.type === 'percent_off' ? Math.round((item.price * r.value) / 100) : r.value;
    if (!Number.isFinite(off) || off < 0 || (r.type === 'percent_off' && r.value > 100)) bad('Pricing rule value is not valid.');
    const p = Math.max(0, item.price - off);
    if (p < best.price) best = { price: p, rule: r.label || 'Time offer' };
  }
  return best;
}
module.exports = { soldMl, bottleVariance, ruleActive, priceNow };
