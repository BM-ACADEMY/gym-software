'use strict';
// Sales reports (area 4). paid bills only: { date:'YYYY-MM-DD', hour:0..23, staffId, number, total, taxable, lines:[{ name, qty, total }] }.
const add = (m, k, v) => { m[k] = (m[k] || 0) + v; };
const rows = (m, keyName) => Object.entries(m).map(([k, v]) => ({ [keyName]: k, ...v }));
function group(bills, keyOf) {
  const m = {};
  for (const b of bills) { const k = keyOf(b); const g = (m[k] = m[k] || { bills: 0, sales: 0 }); g.bills += 1; g.sales += b.total; }
  return m;
}
const mondayOf = (d) => { const t = new Date(d + 'T00:00:00Z'); const back = (t.getUTCDay() + 6) % 7; t.setUTCDate(t.getUTCDate() - back); return t.toISOString().slice(0, 10); };
const byDay = (bills) => rows(group(bills, (b) => b.date), 'date').sort((a, b) => a.date.localeCompare(b.date));
const byWeek = (bills) => rows(group(bills, (b) => mondayOf(b.date)), 'weekStart').sort((a, b) => a.weekStart.localeCompare(b.weekStart));
const byMonth = (bills) => rows(group(bills, (b) => b.date.slice(0, 7)), 'month').sort((a, b) => a.month.localeCompare(b.month));
const byStaff = (bills) => rows(group(bills, (b) => b.staffId || 'none'), 'staffId').sort((a, b) => b.sales - a.sales);
const byHour = (bills) => rows(group(bills, (b) => b.hour), 'hour').map((r) => ({ ...r, hour: Number(r.hour) })).sort((a, b) => a.hour - b.hour);
function byItem(bills) {
  const m = {};
  for (const b of bills) for (const l of b.lines) { const g = (m[l.name] = m[l.name] || { qty: 0, sales: 0 }); g.qty += l.qty; g.sales += l.total; }
  return rows(m, 'name').sort((a, b) => b.sales - a.sales);
}
// Sales per item for insights.bestWorst: { key, name, qty, revenue } (revenue = taxable).
module.exports = { byDay, byWeek, byMonth, byStaff, byHour, byItem, mondayOf };
