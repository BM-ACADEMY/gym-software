'use strict';
// Turns stored records (plain objects) into the plain lists the rules in this folder want. Pure: no database.
const { istDay, int, valid } = require('./dates');
const id = (v) => (v === null || v === undefined ? null : String(v));

const itemsOf = (docs) => (docs || []).map((d) => ({ id: id(d._id), name: d.name, trackStock: !!d.trackStock, qty: Number(d.qty) || 0, cost: d.cost, price: d.price, reorderLevel: d.reorderLevel, expiresAt: d.expiresAt, isActive: d.isActive !== false }));
// One row per bill line that names an item, dated by the shop's day. Fully returned bills do not count as sales.
function salesOf(bills) {
  const out = [];
  for (const b of bills || []) {
    if (!b || b.status === 'returned' || !b.createdAt) continue;
    const date = istDay(b.createdAt);
    for (const l of b.lines || []) if (l && l.itemId && Number(l.qty) > 0) out.push({ itemId: id(l.itemId), qty: Number(l.qty), date });
  }
  return out;
}
const billsOf = (docs) => (docs || []).map((b) => ({ id: id(b._id), number: b.number, by: id(b.by), subtotal: b.subtotal, discount: b.discount, total: b.total, credit: b.credit, change: b.change, status: b.status, payments: b.payments || [] }));

// Ledger entries: pay-later bills, recorded payments, then one balancing entry per customer so the ledger ends at the
// customer's stored balance (creditDue). The balancing entry covers opening balances from a CSV import (positive) and
// credit taken back by returns (negative). creditDue is the truth the owner sees; the entries only add the AGE.
function ledger({ bills, payments, customers }) {
  const e = [];
  for (const b of bills || []) if (b && b.credit > 0 && b.customerId && b.createdAt && b.status !== 'returned') e.push({ customerId: id(b.customerId), type: 'credit', amount: int(b.credit), date: istDay(b.createdAt) });
  for (const p of payments || []) if (p && p.customerId && Number.isInteger(p.amount) && p.amount > 0 && valid(p.day)) e.push({ customerId: id(p.customerId), type: 'payment', amount: p.amount, date: p.day });
  const net = {};
  for (const x of e) net[x.customerId] = (net[x.customerId] || 0) + (x.type === 'credit' ? x.amount : -x.amount);
  for (const c of customers || []) {
    const cid = id(c._id); const due = Math.max(0, int(c.creditDue)); const delta = due - (net[cid] || 0);
    const date = c.createdAt ? istDay(c.createdAt) : null; if (!date) continue;
    if (delta > 0) e.push({ customerId: cid, type: 'credit', amount: delta, date });
    else if (delta < 0) e.push({ customerId: cid, type: 'payment', amount: -delta, date });
  }
  return e;
}
module.exports = { itemsOf, salesOf, billsOf, ledger };
