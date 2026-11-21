'use strict';
// Import of the old register (paper copied into a sheet, or an export) into Vehicles. A preview comes first; nothing is saved
// until the owner confirms. Pure: no database. Plate is the key. Reuses the shared CSV reader from core-pos.
const { parseCsv } = require('../../../packages/core-pos/src/csvImport');
const V = require('./vehicles');
const MAX_ROWS = 2000; const MAX_CHARS = 400000;
const ALIASES = {
  plate: ['plate', 'number plate', 'vehicle number', 'vehicle no', 'vehicle no ', 'reg no', 'registration', 'registration number', 'regn no', 'car number', 'bike number', 'number'],
  klass: ['class', 'type', 'vehicle type', 'vehicle class', 'category', 'segment'],
  ownerName: ['name', 'owner', 'owner name', 'customer', 'customer name'],
  ownerPhone: ['phone', 'mobile', 'mobile number', 'phone number', 'contact', 'contact number', 'owner phone', 'whatsapp'],
};
const KLASS = { bike: 'bike', scooter: 'bike', scooty: 'bike', motorcycle: 'bike', 'two wheeler': 'bike', '2 wheeler': 'bike', hatchback: 'hatchback', hatch: 'hatchback', sedan: 'sedan', suv: 'suv', muv: 'suv', van: 'other', other: 'other' };
const norm = (h) => String(h || '').toLowerCase().replace(/[_\-.*()]+/g, ' ').replace(/\s+/g, ' ').trim();
// A text cell that starts like a formula would run in a spreadsheet when exported: strip those characters.
const safeText = (v) => String(v || '').trim().replace(/^[=+\-@\t\r]+/, '').slice(0, 120);

// existing: Set of plates already saved. Returns { rows, errors, duplicates, total, truncated } or { error }.
function parseVehicles(text, existing = new Set()) {
  if (typeof text !== 'string' || !text.trim()) return { error: 'Paste or upload the register as CSV' };
  if (text.length > MAX_CHARS) return { error: 'That file is too big. Send it in parts of up to ' + MAX_ROWS + ' rows.' };
  const cells = parseCsv(text); if (cells.length < 2) return { error: 'The file needs a header row and at least one vehicle' };
  const map = {}; cells[0].forEach((h, i) => { const c = norm(h); for (const [f, names] of Object.entries(ALIASES)) if (names.includes(c) && !Object.values(map).includes(f)) map[i] = f; });
  if (!Object.values(map).includes('plate')) return { error: 'No number plate column found. Name it "Vehicle number" or "Plate".' };
  const rows = []; const errors = []; const seen = new Set(); let duplicates = 0;
  const body = cells.slice(1); const truncated = body.length > MAX_ROWS;
  body.slice(0, MAX_ROWS).forEach((r, k) => {
    const o = {}; for (const [i, f] of Object.entries(map)) o[f] = (r[i] || '').trim();
    const line = k + 2; const plate = V.normalizePlate(o.plate);
    if (!V.validPlate(plate)) { errors.push({ line, message: 'Number plate "' + String(o.plate).slice(0, 20) + '" does not look right' }); return; }
    if (seen.has(plate)) { errors.push({ line, message: plate + ' is in the file twice' }); return; }
    seen.add(plate);
    const k2 = KLASS[norm(o.klass)];
    if (!k2) { errors.push({ line, message: plate + ': choose a class (bike, hatchback, sedan, suv, other)' }); return; }
    const phone = String(o.ownerPhone || '').replace(/\D/g, '').replace(/^(91|0)(?=\d{10}$)/, '');
    if (phone && !/^[6-9]\d{9}$/.test(phone)) { errors.push({ line, message: plate + ': phone number does not look right' }); return; }
    const isDup = existing.has(plate); if (isDup) duplicates += 1;
    rows.push({ plate, klass: k2, ownerName: safeText(o.ownerName), ownerPhone: phone || undefined, exists: isDup });
  });
  return { rows, errors, duplicates, total: body.length, truncated };
}
module.exports = { MAX_ROWS, MAX_CHARS, parseVehicles, safeText };
