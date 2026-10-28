// Stock maths shared by Mart, Cloth, Dine and Salon (consumables). Pure functions.
const bad = (m) => { const e = new Error(m); e.code = 'STOCK_INVALID'; throw e; };
const IN = new Set(['purchase', 'return_in', 'adjust_up', 'opening']);
const OUT = new Set(['sale', 'return_out', 'adjust_down', 'waste', 'use']);

// Returns the new quantity. Selling more than you have is refused unless the owner allows negative stock.
const apply = (current, move, { allowNegative = false } = {}) => {
  const qty = Number(move.qty);
  if (!Number.isFinite(qty) || qty <= 0) bad('Quantity must be more than zero.');
  if (!IN.has(move.type) && !OUT.has(move.type)) bad(`Unknown stock movement "${move.type}".`);
  const next = IN.has(move.type) ? current + qty : current - qty;
  if (next < 0 && !allowNegative) bad('Not enough stock.');
  return next;
};

const quantityOf = (movements, opts) => movements.reduce((q, m) => apply(q, m, opts), 0);

const lowStock = (items) => items.filter((i) => i.reorderLevel != null && i.qty <= i.reorderLevel).sort((a, b) => a.qty - b.qty);

// Batches with an expiry date inside the next `days` days (or already expired).
const expiring = (batches, now = new Date(), days = 30) => {
  const limit = new Date(now.getTime() + days * 86400000);
  return batches.filter((b) => b.expiresAt && b.qty > 0 && new Date(b.expiresAt) <= limit)
    .map((b) => ({ ...b, expired: new Date(b.expiresAt) <= now }))
    .sort((a, b) => new Date(a.expiresAt) - new Date(b.expiresAt));
};

// Sell from the batch that expires first (FEFO). Returns [{ batchId, qty }] or throws when stock is short.
const pickBatches = (batches, qty) => {
  let need = qty; const out = [];
  const sorted = [...batches].filter((b) => b.qty > 0).sort((a, b) => (a.expiresAt ? new Date(a.expiresAt) : Infinity) - (b.expiresAt ? new Date(b.expiresAt) : Infinity));
  for (const b of sorted) { if (need <= 0) break; const take = Math.min(b.qty, need); out.push({ batchId: b.id, qty: take }); need -= take; }
  if (need > 0) bad('Not enough stock.');
  return out;
};

module.exports = { apply, quantityOf, lowStock, expiring, pickBatches };
