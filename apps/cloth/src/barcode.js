'use strict';
// CLO-06: barcode labels, scan lookup and fabric by the metre. Pure: no database. Written, not yet tested by a person.
// Fabric: a variant with unit 'metre' keeps its stock in CENTIMETRES (a whole number), so no decimal stock drifts. The price (mrp) is per metre.
// A bill line for fabric carries metres (up to 2 decimals); the stock taken is round(metres * 100) centimetres.
const { toCsv } = require('./accounts'); const C128 = require('./code128');
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const UNITS = ['piece', 'metre'];

// Barcode text a shop may use: letters, digits, dash, dot, slash, up to 40. Anything else is refused (it goes into labels and CSV).
const barcodeOk = (s) => typeof s === 'string' && /^[A-Za-z0-9][A-Za-z0-9._\/-]{0,39}$/.test(s);
const scanKey = (s) => String(s == null ? '' : s).trim().slice(0, 40);

// metres (number or string like "2.5") -> whole centimetres, or null when not a clean 0.01 step above zero (max 500 m).
function metresToCm(m) {
  const n = Number(m); if (!Number.isFinite(n) || n <= 0 || n > 500) return null;
  const cm = Math.round(n * 100); return Math.abs(n * 100 - cm) < 1e-6 ? cm : null;
}
const cmToMetres = (cm) => Math.round(cm) / 100;
const metresText = (cm) => `${cmToMetres(cm).toFixed(2).replace(/\.?0+$/, '')} m`;
// Fabric line amount in whole rupees: price per metre x metres, rounded.
const fabricAmount = (pricePerMetre, cm) => Math.round((pricePerMetre * cm) / 100);

// Label rows from variants. copies: stock count by default (owner can pass a number for all). Max 500 labels per print.
function labelRows(variants, { copies } = {}) {
  const rows = [];
  for (const v of variants || []) {
    if (!v || !v.isActive && v.isActive !== undefined) continue;
    const code = v.barcode || ''; if (!barcodeOk(code)) continue; // no barcode yet: not printable
    const n = copies == null ? Math.max(1, Math.min(10, v.unit === 'metre' ? 1 : Number(v.qty) || 1)) : Math.max(1, Math.min(50, Math.floor(Number(copies)) || 1));
    for (let i = 0; i < n && rows.length < 500; i++) rows.push({ barcode: code, style: v.style, size: v.size, colour: v.colour, mrp: v.mrp, unit: v.unit === 'metre' ? 'per metre' : 'piece', currency: v.currency || 'INR' });
  }
  return rows;
}
const labelsCsv = (rows) => toCsv(['barcode', 'style', 'size', 'colour', 'mrp', 'unit', 'currency'], rows);
// Printable page: 3 columns of labels. Each label has a real Code 128 barcode (SVG) and the code printed under it.
function labelsHtml(rows, shop = '') {
  const cells = rows.map((r) => `<div class="l"><b>${esc(r.style)}</b><br>${esc(r.size)} · ${esc(r.colour)}<br>Rs ${esc(r.mrp)} ${r.unit === 'per metre' ? '/ m' : ''}<br>${C128.svg(r.barcode, { moduleWidth: 1, height: 36, showText: false })}<br><span class="c">${esc(r.barcode)}</span></div>`).join('');
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="robots" content="noindex"><title>Labels ${esc(shop)}</title><style>body{font:12px sans-serif;margin:8px}.g{display:grid;grid-template-columns:repeat(3,1fr);gap:6px}.l{border:1px dashed #999;padding:6px;text-align:center;break-inside:avoid}.c{font:13px monospace;letter-spacing:2px}</style></head><body><div class="g">${cells}</div></body></html>`;
}
// Scan: look a code up in a list of variants (the route uses the database; this is for plain checks and for the client).
const findByBarcode = (variants, code) => { const k = scanKey(code); return k ? (variants || []).find((v) => v.barcode === k && v.isActive !== false) || null : null; };
// A bill line from a scanned variant. Pieces: qty whole number. Metre: metres up to 2 decimals.
function lineFromScan(variant, { qty, metres } = {}) {
  if (!variant) return { error: 'No item with that barcode.' };
  if (variant.unit === 'metre') { const cm = metresToCm(metres != null ? metres : qty); if (cm === null) return { error: 'Enter metres with up to 2 decimals, for example 2.5.' }; return { line: { variantId: String(variant._id || variant.id), qty: cmToMetres(cm) }, cm }; }
  const q = qty == null ? 1 : Number(qty); if (!Number.isInteger(q) || q < 1 || q > 999) return { error: 'Quantity must be a whole number of pieces.' };
  return { line: { variantId: String(variant._id || variant.id), qty: q }, cm: null };
}
module.exports = { UNITS, barcodeOk, scanKey, metresToCm, cmToMetres, metresText, fabricAmount, labelRows, labelsCsv, labelsHtml, findByBarcode, lineFromScan };
