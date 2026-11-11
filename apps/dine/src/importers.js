'use strict';
// CSV import for Dine (Phase 2 item 4): ingredients, recipes and customers. Pure: no database, no clock.
// Two steps every time. PREVIEW reads the file and shows what would be added and which rows are wrong; nothing is saved.
// COMMIT reads the same file again on the server and saves only the good rows. The screen never sends "already checked" rows.
const { parseCsv, parseCustomers, MAX_ROWS } = require('../../../packages/core-pos/src/csvImport');
const bad = (m) => { const e = new Error(m); e.code = 'IMPORT_INVALID'; throw e; };
const clean = (h) => String(h || '').toLowerCase().replace(/[_\-.*()]+/g, ' ').replace(/\s+/g, ' ').trim();
const num = (v) => { const n = Number(String(v == null ? '' : v).replace(/,/g, '')); return Number.isFinite(n) && String(v).trim() !== '' ? n : null; };
const ING_ALIASES = { name: ['name', 'ingredient', 'ingredient name', 'item'], unit: ['unit', 'uom'], cost: ['cost', 'cost per unit', 'rate', 'price'], qty: ['qty', 'stock', 'opening stock', 'quantity'], reorderLevel: ['reorder level', 'reorder', 'min stock'] };
const REC_ALIASES = { dish: ['dish', 'dish key', 'item', 'menu item', 'recipe'], ingredient: ['ingredient', 'ingredient name', 'raw material'], qty: ['qty', 'quantity', 'amount'], portion: ['portion', 'portions', 'serves'] };

function table(text, aliases, need) {
  const rows = parseCsv(text);
  if (rows.length - 1 > MAX_ROWS) bad(`Too many rows in one go (${rows.length - 1}). Send at most ${MAX_ROWS} at a time.`);
  if (!rows.length) bad('The file is empty.');
  const map = {}; rows[0].forEach((h, idx) => { const c = clean(h); for (const [f, names] of Object.entries(aliases)) if (names.includes(c) && !Object.values(map).includes(f)) map[idx] = f; });
  const fields = Object.values(map);
  for (const n of need) if (!fields.includes(n)) bad(`The file needs a "${n}" column.`);
  return rows.slice(1).map((r, i) => { const o = { _row: i + 2 }; for (const [idx, f] of Object.entries(map)) o[f] = String(r[idx] == null ? '' : r[idx]).trim(); return o; });
}
// Spreadsheet formulas typed into a name would run when someone opens an export later, so a leading = + - @ is refused.
const formulaLike = (s) => /^[=+\-@\t\r]/.test(String(s || ''));

function parseIngredients(text) {
  const ok = []; const errors = []; const seen = new Set();
  for (const r of table(text, ING_ALIASES, ['name'])) {
    const e = (m) => errors.push({ row: r._row, message: m });
    if (!r.name) { e('Name is empty.'); continue; } if (formulaLike(r.name)) { e('Name cannot start with = + - or @.'); continue; }
    const cost = r.cost === '' ? 0 : num(r.cost); if (cost === null || cost < 0) { e(`Cost "${r.cost}" is not a number.`); continue; }
    const qty = r.qty === '' ? 0 : num(r.qty); if (qty === null || qty < 0) { e(`Stock "${r.qty}" is not a number.`); continue; }
    const reorder = r.reorderLevel === '' || r.reorderLevel === undefined ? undefined : num(r.reorderLevel); if (reorder === null) { e(`Reorder level "${r.reorderLevel}" is not a number.`); continue; }
    const k = r.name.toLowerCase(); if (seen.has(k)) { e(`"${r.name}" appears twice in the file.`); continue; } seen.add(k);
    ok.push({ _row: r._row, name: r.name.slice(0, 80), unit: (r.unit || '').slice(0, 10), costPerUnit: cost, qty, reorderLevel: reorder });
  }
  return { ok, errors };
}
// dishes: [{ key, name }] on the menu. ingredients: [{ id, name }] already saved. One row per dish and ingredient.
function parseRecipes(text, dishes, ingredients) {
  const dishBy = new Map(); for (const d of dishes || []) { dishBy.set(String(d.key).toLowerCase(), d.key); dishBy.set(String(d.name).toLowerCase(), d.key); }
  const ingBy = new Map((ingredients || []).map((i) => [String(i.name).toLowerCase(), i.id]));
  const by = {}; const errors = [];
  for (const r of table(text, REC_ALIASES, ['dish', 'ingredient', 'qty'])) {
    const e = (m) => errors.push({ row: r._row, message: m });
    const key = dishBy.get(String(r.dish).toLowerCase()); if (!key) { e(`Dish "${r.dish}" is not on your menu.`); continue; }
    const id = ingBy.get(String(r.ingredient).toLowerCase()); if (!id) { e(`Ingredient "${r.ingredient}" is not on your list. Import or add the ingredient first.`); continue; }
    const q = num(r.qty); if (q === null || q <= 0) { e(`Quantity "${r.qty}" must be a number above zero.`); continue; }
    const p = r.portion === '' || r.portion === undefined ? 1 : num(r.portion); if (p === null || p <= 0) { e(`Portion "${r.portion}" must be above zero.`); continue; }
    const d = by[key] || (by[key] = { dishKey: key, portion: p, parts: [] });
    if (d.parts.some((x) => x.ingredientId === id)) { e(`"${r.ingredient}" appears twice for "${r.dish}".`); continue; }
    d.parts.push({ ingredientId: id, qty: q });
  }
  return { ok: Object.values(by), errors };
}
// Customers: reuse the shared parser. Dine keeps no opening credit from a file (credit comes only from real bills), so that is reported, not saved.
function parseGuests(text) {
  const r = parseCustomers(text); const withCredit = r.ok.filter((c) => c.credit > 0).length;
  return { ok: r.ok.map((c) => ({ _row: c._row, name: c.name, phone: c.phone, points: c.points || 0 })), errors: r.errors, ignoredCredit: withCredit };
}
module.exports = { parseIngredients, parseRecipes, parseGuests, formulaLike };
