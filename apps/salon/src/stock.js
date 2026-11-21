'use strict';
// Retail stock and product use per service: what each service uses up, how long stock will last (an estimate), and a
// count-versus-system check. Pure: the route does the guarded writes. Quantities are whole units (a unit can be one ml or one bottle: the owner picks).
const int = (n) => Math.round(Number(n) || 0);
const DAY = 86400000;
const days = (a, b) => Math.round((Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / DAY);

function validateProduct(b) {
  const name = String(b.name || '').trim().slice(0, 80); if (name.length < 2) return { error: 'Give the product a name.' };
  const stock = Number(b.stock === undefined ? 0 : b.stock); const reorder = Number(b.reorderLevel === undefined ? 0 : b.reorderLevel);
  if (!Number.isInteger(stock) || stock < 0 || stock > 1e6) return { error: 'Stock must be a whole number.' };
  if (!Number.isInteger(reorder) || reorder < 0 || reorder > 1e6) return { error: 'Reorder level must be a whole number.' };
  const price = b.price === undefined ? 0 : Number(b.price); if (!Number.isInteger(price) || price < 0 || price > 10000000) return { error: 'Price must be whole rupees.' };
  const gstRate = b.gstRate === undefined ? 0 : Number(b.gstRate); if (![0, 3, 5, 12, 18, 28].includes(gstRate)) return { error: 'GST rate must be 0, 3, 5, 12, 18 or 28.' };
  return { value: { name, unit: String(b.unit || 'pcs').trim().slice(0, 12) || 'pcs', stock, reorderLevel: reorder, price, currency: 'INR', gstRate, forSale: b.forSale === true } };
}
// Which products a bill uses up. services: { key: { uses: [{productId, qty}] } }. Bill lines: service lines use the service's list; retail lines name the product.
function usageForBill(lines, services) {
  const out = {};
  for (const l of lines || []) {
    const qty = Math.max(1, int(l.qty) || 1);
    if (l.productId) { out[String(l.productId)] = (out[String(l.productId)] || 0) + qty; continue; }
    const svc = l.serviceKey && services ? services[l.serviceKey] : null;
    for (const u of (svc && svc.uses) || []) if (u && u.productId && int(u.qty) > 0) out[String(u.productId)] = (out[String(u.productId)] || 0) + int(u.qty) * qty;
  }
  return Object.entries(out).map(([productId, qty]) => ({ productId, qty }));
}
function validateUses(list) {
  if (!Array.isArray(list) || list.length > 20) return { error: 'Send up to 20 products for a service.' };
  const out = []; for (const u of list) { if (!u || !/^[0-9a-f]{24}$/i.test(String(u.productId)) || !Number.isInteger(u.qty) || u.qty < 1 || u.qty > 100000) return { error: 'Each product needs an id and a whole quantity of 1 or more.' }; out.push({ productId: String(u.productId), qty: u.qty }); }
  return { value: out };
}
// How long the stock will last, from the last 30 days of use. An ESTIMATE: it says what it used, and says "not enough data" under 14 days of history or 5 uses.
function runOut({ stock, moves, today }) {
  const use = (moves || []).filter((m) => (m.reason === 'use' || m.reason === 'sale') && m.date && days(m.date, today) <= 30 && days(m.date, today) >= 0);
  const first = use.reduce((min, m) => (m.date < min ? m.date : min), today); const span = Math.max(1, days(first, today) + 1);
  if (use.length < 5 || span < 14) return { enough: false, text: 'Not enough use recorded yet to estimate. We need about two weeks.' };
  const used = use.reduce((n, m) => n + Math.abs(int(m.qty)), 0); const perDay = used / span;
  if (perDay <= 0) return { enough: true, perDay: 0, daysLeft: null, text: 'Not used in the last 30 days.' };
  const daysLeft = Math.floor(int(stock) / perDay);
  return { enough: true, perDay: Math.round(perDay * 10) / 10, daysLeft, basis: `${used} used over ${span} days`, text: `Estimate, not a promise: about ${daysLeft} days left, from ${used} used over the last ${span} days.` };
}
// Count versus what the system says. Positive difference = more on the shelf than the system thinks.
const countDiff = ({ system, counted }) => { const d = int(counted) - int(system); return { system: int(system), counted: int(counted), diff: d, flagged: d !== 0 }; };
module.exports = { validateProduct, usageForBill, validateUses, runOut, countDiff };
