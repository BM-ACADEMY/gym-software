'use strict';
// Owner daily summary (area 10): the day in numbers, what looks wrong, and at most THREE things to do today.
// Every action carries its reason, built from the owner's own numbers, so it can be trusted or rejected.
// Suggest only: nothing here sends or changes anything. Thresholds are Assumptions the owner can change.
const { leakageFlags, slowHours, staffDiscounts } = require('./insights');
const { stockRunOut } = require('./predict');
const { winBackList, slowHourOffer } = require('./marketing');

function dailySummary({ date, bills, leak, close, foodCost, byHour, stock, dailyUse, customers, menu, venue, pubMode = false, foodCostLimit = 35 }) {
  const sales = bills.reduce((a, b) => a + b.total, 0);
  const headline = { date, bills: bills.length, sales, averageBill: bills.length ? Math.round(sales / bills.length) : 0, currency: 'INR' };
  const flags = leakageFlags({ bills: bills.length, grossSales: bills.reduce((a, b) => a + (b.subtotal || b.total), 0), discountTotal: bills.reduce((a, b) => a + (b.discount || 0), 0), voidsAfterSend: (leak && leak.voidsAfterSend) || 0, reopens: (leak && leak.reopens) || 0, cashExpected: close ? close.expected : undefined, cashCounted: close ? close.counted : undefined });
  const staffD = staffDiscounts(bills).map((d) => ({ code: 'staff_discount', count: d.count, total: d.total, reason: 'Staff gave ' + d.count + ' discount' + (d.count === 1 ? '' : 's') + ' worth Rs ' + d.total + ' today. Each has a reason on its bill.' }));
  const actions = [];
  for (const f of staffD) actions.push({ rank: 1, kind: 'check', what: 'Look at the discounts your staff gave and the reasons', reason: f.reason });
  for (const f of flags) actions.push({ rank: 1, kind: 'check', what: f.code === 'cash_short' ? 'Recount the cash and ask who handled it' : f.code === 'voids' ? 'Look at today\'s voided items and the reasons' : f.code === 'discounts' ? 'Look at who gave the discounts and why' : 'Look at the reopened bills', reason: f.reason });
  if (foodCost && foodCost.percent !== null && foodCost.percent > foodCostLimit) actions.push({ rank: 2, kind: 'cost', what: 'Check portions and wastage for your top dishes', reason: 'Food cost today was ' + foodCost.percent + ' percent of sales, above your ' + foodCostLimit + ' percent line.' });
  for (const s of stockRunOut(stock || [], dailyUse || {}, 2).slice(0, 2)) actions.push({ rank: 3, kind: 'stock', what: 'Order ' + s.name + ' today', reason: s.reason });
  const slow = slowHours(byHour || []);
  const offer = !pubMode ? slowHourOffer(slow, menu || [], venue || 'us') : null;
  if (offer) actions.push({ rank: 4, kind: 'marketing', what: offer.suggestion, reason: offer.reason, template: offer.template });
  const win = winBackList(customers || [], date, venue || 'us');
  if (win.length) actions.push({ rank: 5, kind: 'marketing', what: 'Call or message ' + Math.min(win.length, 5) + ' regular(s) who have not visited', reason: win.length + ' customer(s) have been away 45 days or more. The longest is ' + win[0].name + ' (' + win[0].daysAway + ' days).', template: win[0].template });
  return { headline, flags, staffDiscounts: staffD, actions: actions.sort((a, b) => a.rank - b.rank).slice(0, 3), mode: 'suggest', note: 'These are suggestions from your own numbers. Nothing is sent unless you switch it on.' };
}
module.exports = { dailySummary };
