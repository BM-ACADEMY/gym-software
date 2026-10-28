// CSV import for shop products: items (with opening stock) and customers (with opening udhaar).
// Pure: no database, no network. The router adds duplicate checks against the shop's own data.
// Accepts files exported from Excel, Google Sheets, Vyapar, myBillBook and similar: any common header names.
const { GST_SLABS } = require('./bill');

const MAX_ROWS = 1000; // per request; the screen sends bigger files in chunks

// ---- CSV text -> rows of cells (quotes, doubled quotes, CRLF, BOM, comma / semicolon / tab) ----
const parseCsv = (text) => {
  let s = String(text || '').replace(/^﻿/, '');
  const first = s.split(/\r?\n/, 1)[0] || '';
  const delim = [',', ';', '\t'].map((d) => [d, first.split(d).length]).sort((a, b) => b[1] - a[1])[0][0];
  const rows = []; let row = []; let cell = ''; let q = false;
  for (let i = 0; i < s.length; i += 1) {
    const c = s[i];
    if (q) {
      if (c === '"') { if (s[i + 1] === '"') { cell += '"'; i += 1; } else q = false; } else cell += c;
    } else if (c === '"') q = true;
    else if (c === delim) { row.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && s[i + 1] === '\n') i += 1; row.push(cell); cell = ''; if (row.some((x) => x.trim() !== '')) rows.push(row); row = []; }
    else cell += c;
  }
  row.push(cell); if (row.some((x) => x.trim() !== '')) rows.push(row);
  return rows;
};

const clean = (h) => String(h || '').toLowerCase().replace(/[_\-.*()]+/g, ' ').replace(/\s+/g, ' ').trim();
const mapHeaders = (headers, aliases) => {
  const out = {};
  headers.forEach((h, idx) => { const c = clean(h); for (const [field, names] of Object.entries(aliases)) if (names.includes(c) && !Object.values(out).includes(field)) out[idx] = field; });
  return out;
};
const toObjects = (rows, aliases) => {
  if (rows.length < 1) return { map: {}, records: [] };
  const map = mapHeaders(rows[0], aliases);
  const records = rows.slice(1).map((r, i) => { const o = { _row: i + 2 }; for (const [idx, f] of Object.entries(map)) o[f] = (r[idx] ?? '').trim(); return o; });
  return { map, records };
};

const money = (v) => { // "Rs 1,200.50", "1200", "₹ 99" -> whole rupees; text with no digits is not an amount
  const t = String(v ?? '');
  if (!/\d/.test(t)) return null;
  const n = Number(t.replace(/[^0-9.\-]/g, ''));
  return Number.isFinite(n) ? Math.round(n) : null;
};
const qtyNum = (v) => { const n = Number(String(v ?? '').replace(/,/g, '')); return Number.isFinite(n) && String(v).trim() !== '' ? n : null; };
const normalizePhone = (v) => { let d = String(v ?? '').replace(/\D/g, ''); if (d.length === 12 && d.startsWith('91')) d = d.slice(2); if (d.length === 11 && d.startsWith('0')) d = d.slice(1); return d; };
const validPhone = (d) => /^[6-9]\d{9}$/.test(d);
const parseDate = (v) => {
  const t = String(v ?? '').trim(); if (!t) return null;
  let m = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (m) { const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])); return d.getUTCMonth() === +m[2] - 1 ? d : undefined; }
  m = t.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2}|\d{4})$/);
  if (m) { const y = m[3].length === 2 ? 2000 + +m[3] : +m[3]; const d = new Date(Date.UTC(y, +m[2] - 1, +m[1])); return d.getUTCMonth() === +m[2] - 1 && d.getUTCDate() === +m[1] ? d : undefined; }
  return undefined;
};

const ITEM_ALIASES = {
  name: ['name', 'item', 'item name', 'product', 'product name', 'description'],
  barcode: ['barcode', 'bar code', 'ean', 'upc', 'code'],
  sku: ['sku', 'item code', 'product code'],
  price: ['price', 'selling price', 'sale price', 'sp', 'mrp', 'rate', 'sales price'],
  cost: ['cost', 'cost price', 'purchase price', 'buying price', 'cp'],
  gstRate: ['gst', 'gst rate', 'gst %', 'tax', 'tax rate', 'tax %'],
  qty: ['qty', 'quantity', 'stock', 'opening stock', 'current stock', 'closing stock', 'stock qty'],
  unit: ['unit', 'uom', 'units'],
  category: ['category', 'group', 'item category'],
  reorderLevel: ['reorder level', 'min stock', 'minimum stock', 'low stock alert', 'reorder'],
  expiresAt: ['expiry', 'expiry date', 'exp date', 'expires', 'best before'],
  hsn: ['hsn', 'hsn code', 'hsn sac', 'sac'],
};
const CUSTOMER_ALIASES = {
  name: ['name', 'customer', 'customer name', 'party name', 'party', 'full name'],
  phone: ['phone', 'mobile', 'mobile number', 'mobile no', 'phone number', 'contact', 'whatsapp', 'whatsapp number'],
  email: ['email', 'email id', 'e mail'],
  credit: ['credit', 'udhaar', 'balance', 'outstanding', 'amount due', 'due', 'opening balance', 'receivable'],
  points: ['points', 'loyalty points', 'reward points'],
  note: ['note', 'notes', 'remarks', 'address'],
};

// Returns { ok: [records], errors: [{ row, message }], map } (nothing is saved here).
const parseItems = (text) => {
  const rows = parseCsv(text);
  if (rows.length - 1 > MAX_ROWS) return { ok: [], errors: [{ row: 0, message: `Too many rows in one go (${rows.length - 1}). Send at most ${MAX_ROWS} at a time.` }], map: {} };
  const { map, records } = toObjects(rows, ITEM_ALIASES);
  const fields = Object.values(map);
  if (!fields.includes('name') || !fields.includes('price')) return { ok: [], errors: [{ row: 1, message: 'The file needs a name column and a price column (for example "Item name" and "Selling price").' }], map };
  const ok = []; const errors = []; const seen = new Set();
  for (const r of records) {
    const bad = (message) => errors.push({ row: r._row, message });
    if (!r.name) { bad('Name is empty.'); continue; }
    const price = money(r.price);
    if (price === null || price < 0) { bad(`Price "${r.price}" is not a number.`); continue; }
    let gstRate = 0;
    if (r.gstRate) { gstRate = money(r.gstRate); if (gstRate === null || !GST_SLABS.includes(gstRate)) { bad(`GST "${r.gstRate}" is not one of ${GST_SLABS.join(', ')}.`); continue; } }
    const qty = r.qty ? qtyNum(r.qty) : 0;
    if (qty === null || qty < 0) { bad(`Stock "${r.qty}" is not a valid number.`); continue; }
    const cost = r.cost ? money(r.cost) : undefined;
    if (r.cost && (cost === null || cost < 0)) { bad(`Cost "${r.cost}" is not a number.`); continue; }
    const reorderLevel = r.reorderLevel ? qtyNum(r.reorderLevel) : undefined;
    if (r.reorderLevel && (reorderLevel === null || reorderLevel < 0)) { bad(`Reorder level "${r.reorderLevel}" is not a number.`); continue; }
    const expiresAt = r.expiresAt ? parseDate(r.expiresAt) : undefined;
    if (r.expiresAt && !expiresAt) { bad(`Expiry date "${r.expiresAt}" is not a date (use dd/mm/yyyy or yyyy-mm-dd).`); continue; }
    const key = (r.barcode || r.name).toLowerCase();
    if (seen.has(key)) { bad(`"${r.barcode || r.name}" appears twice in the file.`); continue; }
    seen.add(key);
    ok.push({ _row: r._row, name: r.name.slice(0, 120), barcode: r.barcode || undefined, sku: r.sku || undefined, price, gstRate, qty, cost, unit: r.unit || undefined, category: r.category || undefined, reorderLevel, expiresAt: expiresAt || undefined, hsn: r.hsn || undefined });
  }
  return { ok, errors, map };
};

const parseCustomers = (text) => {
  const rows = parseCsv(text);
  if (rows.length - 1 > MAX_ROWS) return { ok: [], errors: [{ row: 0, message: `Too many rows in one go (${rows.length - 1}). Send at most ${MAX_ROWS} at a time.` }], map: {} };
  const { map, records } = toObjects(rows, CUSTOMER_ALIASES);
  const fields = Object.values(map);
  if (!fields.includes('name')) return { ok: [], errors: [{ row: 1, message: 'The file needs a name column (for example "Customer name").' }], map };
  const ok = []; const errors = []; const seen = new Set();
  for (const r of records) {
    const bad = (message) => errors.push({ row: r._row, message });
    if (!r.name) { bad('Name is empty.'); continue; }
    let phone;
    if (r.phone) { phone = normalizePhone(r.phone); if (!validPhone(phone)) { bad(`Phone "${r.phone}" is not a 10-digit Indian mobile number.`); continue; } if (seen.has(phone)) { bad(`Phone ${phone} appears twice in the file.`); continue; } seen.add(phone); }
    const credit = r.credit ? money(r.credit) : 0;
    if (credit === null || credit < 0) { bad(`Credit "${r.credit}" is not a valid amount.`); continue; }
    if (credit > 0 && !phone) { bad('A customer who owes money needs a phone number.'); continue; }
    const points = r.points ? qtyNum(r.points) : 0;
    if (points === null || points < 0 || !Number.isInteger(points)) { bad(`Points "${r.points}" must be a whole number.`); continue; }
    ok.push({ _row: r._row, name: r.name.slice(0, 120), phone, email: r.email ? r.email.toLowerCase() : undefined, credit, points, note: r.note ? r.note.slice(0, 300) : undefined });
  }
  return { ok, errors, map };
};

module.exports = { parseCsv, parseItems, parseCustomers, MAX_ROWS, ITEM_ALIASES, CUSTOMER_ALIASES };
