'use strict';
// Owner's daily summary and "three things to do today". SUGGEST ONLY: nothing here sends a message. Every action carries the
// reason in plain words so the owner can trust or reject it (docs/PRODUCT_PRINCIPLES.md section 4). No database, no clock.
// Rupee figures that are estimates say so ("about"): they use the current price of the customer's last service (Assumption).
const { lapsed, dueForRebook } = require('./winback');
const sum = (a, f) => a.reduce((t, x) => t + (f(x) || 0), 0);
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

// appointments: today's visits. bills: yesterday's and today's. customers: all (small businesses: hundreds). services: [{key,name,price,cycleDays}]
function dailySummary({ today, yesterday, appointments = [], bills = [], customers = [], services = [], upcomingBirthdays = [] }) {
  const price = {}; const cycles = {};
  for (const s of services) { price[s.key] = s.price || 0; if (Number.isInteger(s.cycleDays)) cycles[s.key] = s.cycleDays; }
  const live = appointments.filter((a) => a.date === today && a.status !== 'cancelled');
  const count = (st) => live.filter((a) => a.status === st).length;
  const bookedToday = count('booked') + count('pending');
  const salesYesterday = sum(bills.filter((b) => b.date === yesterday), (b) => b.received);
  const salesToday = sum(bills.filter((b) => b.date === today), (b) => b.received);
  const due = dueForRebook(customers, today, cycles);
  const gone = lapsed(customers, today, 60).filter((c) => !due.some((d) => d.id === c.id));
  const worth = (rows, byId) => rows.reduce((t, r) => t + (price[(byId[r.id] || {}).lastServiceKey] || 0), 0);
  const byId = Object.fromEntries(customers.map((c) => [c.id, c]));
  const noShowsYesterday = appointments.filter((a) => a.date === yesterday && a.status === 'noshow').length;
  const pending = appointments.filter((a) => a.status === 'pending').length;

  // Candidates in priority order. The first three that apply are shown.
  const actions = [];
  if (pending) actions.push({ kind: 'approve', title: `Answer ${plural(pending, 'booking request', 'booking requests')}`, reason: 'Customers are waiting and the slot is held for them until you accept or decline.', count: pending });
  if (due.length) { const w = worth(due, byId); actions.push({ kind: 'rebook', title: `Message ${plural(due.length, 'customer', 'customers')} due for a repeat visit`, reason: `They are past their usual gap for the last service${w ? `, worth about Rs ${w} if they all come` : ''}. Nothing is sent by us; you decide who to message.`, count: due.length, ids: due.slice(0, 20).map((d) => d.id), amount: w || undefined, currency: 'INR' }); }
  if (noShowsYesterday) actions.push({ kind: 'noshow', title: `Offer to rebook ${plural(noShowsYesterday, 'missed visit', 'missed visits')} from yesterday`, reason: 'Missed visits are the easiest customers to win back in the next two days. Consider a small advance for long services.', count: noShowsYesterday });
  if (gone.length) { const w = worth(gone, byId); actions.push({ kind: 'winback', title: `Bring back ${plural(gone.length, 'customer', 'customers')} not seen in 60 days`, reason: `They have not visited for two months or more${w ? `; their last services add up to about Rs ${w}` : ''}. Pick a few and send a friendly message.`, count: gone.length, ids: gone.slice(0, 20).map((d) => d.id), amount: w || undefined, currency: 'INR' }); }
  if (upcomingBirthdays.length) actions.push({ kind: 'birthday', title: `Wish ${plural(upcomingBirthdays.length, 'customer', 'customers')} a happy birthday`, reason: 'A birthday greeting with a small offer is the lowest-effort way to get a visit.', count: upcomingBirthdays.length, ids: upcomingBirthdays.map((c) => c.id) });
  if (!actions.length) actions.push({ kind: 'share', title: 'Share your booking link on WhatsApp status', reason: 'Nothing urgent today, so use the quiet time to fill tomorrow: customers book straight into free slots.', count: 0 });
  return {
    currency: 'INR', date: today,
    bookings: { today: bookedToday, pending, done: count('done'), noShow: count('noshow') },
    sales: { yesterday: salesYesterday, today: salesToday, currency: 'INR' },
    actions: actions.slice(0, 3).map((a) => ({ ...a, suggestOnly: true })),
  };
}
module.exports = { dailySummary };
