'use strict';
// Sales reports from saved bills: by day, staff, service and hour. Whole rupees before GST (taxable). Pure.
const int = (n) => Math.round(Number(n) || 0);
const istHour = (d) => new Date(new Date(d).getTime() + 5.5 * 3600000).getUTCHours();
const add = (m, k, v) => { m[k] = (m[k] || 0) + v; };
function salesReport(bills) {
  const byDay = {}, byStaff = {}, byService = {}, byHour = {}; let total = 0, count = 0;
  for (const b of bills) {
    count += 1; total += int(b.taxable); add(byDay, b.date, int(b.taxable));
    if (b.createdAt) add(byHour, String(istHour(b.createdAt)), int(b.taxable));
    for (const l of b.lines || []) { if (l.staffId) add(byStaff, String(l.staffId), int(l.taxable)); add(byService, l.serviceKey || l.name || 'item', int(l.taxable)); }
  }
  const top = (m, n = 5) => Object.entries(m).sort((a, b) => b[1] - a[1]).slice(0, n).map(([key, amount]) => ({ key, amount }));
  return { total, bills: count, average: count ? Math.round(total / count) : 0, byDay, byStaff: top(byStaff, 50), byService: top(byService, 50), byHour, currency: 'INR' };
}
// Month key 'YYYY-MM' totals from bills.
const monthlyTotals = (bills) => { const m = {}; for (const b of bills) add(m, String(b.date).slice(0, 7), int(b.taxable)); return m; };
module.exports = { salesReport, monthlyTotals };
