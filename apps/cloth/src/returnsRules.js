'use strict';
// CLO-12: returns and exchanges restore the stock of the exact size and colour that was sold. Pure. Written, not yet tested by a person.
// This handles STOCK and the reason. The money side (refund, loyalty points, pay-later) is done with the shared bill return in core-pos
// (POST /api/pos/bills/:id/return-lines), which the screen offers next to this one.
const { metresToCm } = require('./barcode');
const KINDS = ['return', 'exchange'];
// sales: stock moves of type 'sale' for this bill [{variantId, qty}] (qty in pieces, or centimetres for fabric);
// done: stock moves of type 'return_in' already made for this bill; units: { variantId: 'piece'|'metre' }
// items: [{ variantId, qty }] qty in pieces, or metres for fabric. Returns { moves:[{variantId, qty}] } or { error }.
function plan({ sales, done, items, units = {}, reason, kind = 'return' }) {
  if (!KINDS.includes(kind)) return { error: 'Kind must be return or exchange.' };
  const why = String(reason == null ? '' : reason).trim();
  if (why.length < 3 || why.length > 200) return { error: 'Write the reason (3 to 200 characters).' };
  if (!Array.isArray(items) || !items.length || items.length > 50) return { error: 'Choose at least one item to take back.' };
  const sum = (rows) => rows.reduce((a, r) => { a[String(r.variantId)] = (a[String(r.variantId)] || 0) + (Number(r.qty) || 0); return a; }, {});
  const sold = sum(sales || []), back = sum(done || []), ask = {};
  for (const it of items) {
    const id = it && it.variantId ? String(it.variantId) : ''; if (!id || !(id in sold)) return { error: 'An item to take back was not sold on this bill.' };
    const unit = units[id] === 'metre' ? 'metre' : 'piece';
    const q = unit === 'metre' ? metresToCm(it.qty) : (Number.isInteger(it.qty) && it.qty >= 1 ? it.qty : null);
    if (q === null) return { error: unit === 'metre' ? 'Metres: up to 2 decimals.' : 'Quantity must be a whole number of pieces.' };
    ask[id] = (ask[id] || 0) + q;
  }
  const moves = [];
  for (const [id, q] of Object.entries(ask)) {
    if (q + (back[id] || 0) > sold[id]) return { error: 'You are taking back more than was sold on this bill (after earlier returns).' };
    moves.push({ variantId: id, qty: q });
  }
  return { moves, reason: why, kind };
}
module.exports = { KINDS, plan };
