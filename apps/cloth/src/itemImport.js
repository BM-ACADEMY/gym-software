'use strict';
// CLO-13: item and variant CSV import with a preview. Pure. Columns: style, size, colour, mrp, cost (optional), qty (optional), barcode (optional), category (optional), unit (optional).
// preview() changes nothing; the route saves only the rows that passed, only after the owner confirms.
const { parse } = require('./csvParse'); const V = require('./variants'); const BC = require('./barcode'); const G = require('./gst');
const HEAD = ['style', 'size', 'colour', 'mrp', 'cost', 'qty', 'barcode', 'category', 'unit'];
const norm = (h) => String(h || '').trim().toLowerCase().replace(/[^a-z]/g, '');
const ALIAS = { design: 'style', item: 'style', name: 'style', color: 'colour', price: 'mrp', rate: 'mrp', stock: 'qty', quantity: 'qty', code: 'barcode', sku: 'barcode' };
const whole = (v) => { const t = String(v == null ? '' : v).trim(); return /^\d{1,7}$/.test(t) ? Number(t) : null; };

// existingKeys: Set of variant keys already in the shop. existingBarcodes: Set. bands: GST bands (for the rate shown in the preview).
function preview(text, { existingKeys = new Set(), existingBarcodes = new Set(), bands } = {}) {
  const p = parse(text); if (p.error) return { error: p.error };
  if (!p.rows.length) return { error: 'The file is empty.' };
  const head = p.rows[0].map((h) => { const n = norm(h); return ALIAS[n] || n; });
  for (const need of ['style', 'size', 'colour', 'mrp']) if (!head.includes(need)) return { error: `The first row must have a "${need}" column. Found: ${head.join(', ')}.` };
  const idx = Object.fromEntries(HEAD.map((h) => [h, head.indexOf(h)]));
  const ok = []; const errors = []; const seenKeys = new Set(); const seenCodes = new Set();
  p.rows.slice(1).forEach((r, n) => {
    const line = n + 2; const get = (h) => (idx[h] >= 0 ? String(r[idx[h]] == null ? '' : r[idx[h]]).trim() : '');
    const style = get('style').slice(0, 40), size = get('size').slice(0, 30), colour = get('colour').slice(0, 30);
    if (!style || !size || !colour) return errors.push({ line, message: 'Style, size and colour are all needed.' });
    const mrp = whole(get('mrp')); if (mrp === null || mrp < 1) return errors.push({ line, message: 'MRP must be a whole rupee amount.' });
    const costT = get('cost'); const cost = costT === '' ? undefined : whole(costT); if (costT !== '' && cost === null) return errors.push({ line, message: 'Cost must be a whole rupee amount.' });
    const qtyT = get('qty'); const qty = qtyT === '' ? 0 : whole(qtyT); if (qty === null) return errors.push({ line, message: 'Stock must be a whole number.' });
    const unit = get('unit').toLowerCase() || 'piece'; if (!BC.UNITS.includes(unit)) return errors.push({ line, message: 'Unit must be piece or metre.' });
    if (unit === 'metre' && qty > 0) return errors.push({ line, message: 'For fabric sold by the metre, leave stock empty and add it with Fabric stock.' });
    const barcode = get('barcode'); if (barcode && !BC.barcodeOk(barcode)) return errors.push({ line, message: 'Barcode: letters, numbers, dash, dot or slash, up to 40.' });
    const key = V.key(style, size, colour);
    if (existingKeys.has(key)) return errors.push({ line, message: 'This style, size and colour already exists. Skipped.' });
    if (seenKeys.has(key)) return errors.push({ line, message: 'Repeated in this file. Skipped.' });
    if (barcode && (existingBarcodes.has(barcode) || seenCodes.has(barcode))) return errors.push({ line, message: 'That barcode is already used.' });
    seenKeys.add(key); if (barcode) seenCodes.add(barcode);
    ok.push({ line, style, size, colour, key, mrp, cost, qty, unit, barcode: barcode || undefined, category: get('category').slice(0, 40) || undefined, gstRate: bands ? G.rateFor(mrp, bands) : undefined });
  });
  return { rows: ok, errors, total: p.rows.length - 1 };
}
module.exports = { HEAD, preview };
