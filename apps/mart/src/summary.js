'use strict';
// Owner's daily summary: yesterday's numbers and THREE things to do today. Every action carries its reason and the
// rupees at stake, so the owner can trust it or skip it. Suggestions only; nothing is sent or ordered by itself.
const { int } = require('./dates');

// bills of ONE day. Cash is net of change given back. Pay-later (credit) is not money received.
function salesOf(bills) {
  const r = { total: 0, count: 0, cash: 0, upi: 0, card: 0, other: 0, credit: 0, discount: 0, currency: 'INR' };
  for (const b of bills || []) {
    if (!b || b.status === 'returned') continue;
    r.count += 1; r.total += int(b.total); r.discount += int(b.discount); r.credit += int(b.credit);
    for (const p of b.payments || []) {
      const a = int(p.amount);
      if (p.method === 'cash') r.cash += a; else if (p.method === 'upi') r.upi += a; else if (p.method === 'card') r.card += a; else if (p.method !== 'credit') r.other += a;
    }
    r.cash -= int(b.change);
  }
  return r;
}

function threeActions({ overdue = [], expiring = [], reorder = [], discounts = [], dead = [] }) {
  const sum = (l) => l.reduce((a, x) => a + (x.rupees || x.due || 0), 0);
  const c = [];
  if (overdue.length) c.push({ key: 'udhaar', rupees: sum(overdue), text: `Remind ${overdue.length} customer(s) about udhaar`, reason: `${sum(overdue)} rupees is overdue. Largest: ${overdue[0].due} rupees, ${overdue[0].daysOld} days old.` });
  const soon = expiring.filter((e) => !e.expired);
  if (soon.length) c.push({ key: 'expiry', rupees: sum(soon), text: `Put ${soon.length} item(s) on offer before they expire`, reason: `${sum(soon)} rupees of stock expires within 30 days. Start with ${soon[0].name} (${soon[0].daysLeft} days).` });
  const gone = expiring.filter((e) => e.expired);
  if (gone.length) c.push({ key: 'expired', rupees: sum(gone), text: `Remove ${gone.length} expired item(s) from the shelf`, reason: `${sum(gone)} rupees of stock is past its date.` });
  const urgent = reorder.filter((r) => r.daysLeft !== null && r.daysLeft <= 2);
  if (urgent.length) c.push({ key: 'reorder', rupees: sum(urgent) || urgent.length * 500, text: `Order ${urgent.length} item(s) that run out within 2 days`, reason: `${urgent[0].name}: ${urgent[0].reason}` });
  if (discounts.length) c.push({ key: 'discounts', rupees: sum(discounts), text: `Check ${discounts.length} heavily discounted bill(s)`, reason: discounts[0].reason });
  if (dead.length) c.push({ key: 'dead', rupees: sum(dead), text: `Clear ${dead.length} slow item(s)`, reason: `${sum(dead)} rupees has not moved in 45 days.` });
  return c.sort((a, b) => b.rupees - a.rupees).slice(0, 3).map((x) => ({ ...x, currency: 'INR' }));
}
function dailySummary({ bills, lowStock = [], ...lists }) {
  return { sales: salesOf(bills), lowStockCount: lowStock.length, udhaarOverdueTotal: (lists.overdue || []).reduce((a, x) => a + x.due, 0), actions: threeActions(lists) };
}
module.exports = { salesOf, threeActions, dailySummary };
