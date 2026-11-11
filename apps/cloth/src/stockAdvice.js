'use strict';
// Slow movers, dead stock and the festival rule. Pure: the caller passes the numbers. Dates 'YYYY-MM-DD'.
const day = (s) => Date.parse(s + 'T00:00:00Z'); const DAY = 86400000;

// styles: [{ style, qty, cost, lastSoldOn|null, addedOn }]. A style is SLOW when it holds stock and has not sold for slowDays,
// and DEAD at deadDays. New arrivals (added within slowDays) are never listed. Money tied up = qty x cost (whole rupees).
function slowMovers(styles, today, { slowDays = 60, deadDays = 120 } = {}) {
  const out = [];
  for (const s of styles || []) {
    if (!s || !(s.qty > 0)) continue;
    const added = Math.round((day(today) - day(s.addedOn || today)) / DAY);
    if (added < slowDays) continue;
    const since = Math.round((day(today) - day(s.lastSoldOn || s.addedOn || today)) / DAY);
    if (since < slowDays) continue;
    out.push({ style: s.style, qty: s.qty, daysSinceSale: since, tiedUp: s.qty * (s.cost || 0), level: since >= deadDays ? 'dead' : 'slow', currency: 'INR' });
  }
  return out.sort((a, b) => b.tiedUp - a.tiedUp);
}
// Markdown suggestion: a plain rule, shown WITH its reason. Percent steps 10/20/30 by how long it has not sold; never below cost.
function markdownIdea(item, { price, cost }) {
  const pct = item.level === 'dead' ? 30 : item.daysSinceSale >= 90 ? 20 : 10;
  let np = Math.round(price * (100 - pct) / 100); const floor = cost || 0;
  const atCost = np < floor; if (atCost) np = floor;
  return { percent: pct, newPrice: np, atCostFloor: atCost, reason: `Not sold for ${item.daysSinceSale} days, Rs ${item.tiedUp} of stock at cost is tied up.` };
}
// Festival forecast: units sold in the same window last year, plus the growth percent the owner sets (default 0).
// lastYearSales: [{ date, qty }]. Returns null if last year has no data (new shop): the screen says "import last year's sales".
function festivalForecast(lastYearSales, { from, to, growthPct = 0 }) {
  const rows = (lastYearSales || []).filter((r) => r && r.date >= from && r.date <= to);
  if (!rows.length) return null;
  const units = rows.reduce((a, r) => a + (r.qty || 0), 0);
  return { lastYearUnits: units, forecastUnits: Math.round(units * (100 + growthPct) / 100), growthPct, reason: `Last year ${from} to ${to} you sold ${units} pieces; plus ${growthPct}% you set.` };
}
module.exports = { slowMovers, markdownIdea, festivalForecast };
