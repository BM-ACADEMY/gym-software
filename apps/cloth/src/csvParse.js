'use strict';
// CLO-13: a small, strict CSV reader that understands quoted cells with commas, doubled quotes and line breaks inside quotes.
// Pure. Limits keep one upload small: 1 MB, 2,000 rows, 30 columns. Cells that start with = + - @ are NOT changed here; they are
// only ever stored as plain text and every CSV the app writes guards them (accounts.toCsv).
const MAX_BYTES = 1000000, MAX_ROWS = 2000, MAX_COLS = 30;
function parse(text) {
  if (typeof text !== 'string') return { error: 'No file text received.' };
  if (text.length > MAX_BYTES) return { error: 'The file is too big. Send up to 1 MB at a time.' };
  const s = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  const rows = []; let row = []; let cell = ''; let q = false; let started = false;
  const endCell = () => { row.push(cell); cell = ''; started = false; };
  const endRow = () => { endCell(); if (!(row.length === 1 && row[0].trim() === '')) rows.push(row); row = []; };
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (q) { if (c === '"') { if (s[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += c; continue; }
    if (c === '"' && !started && cell === '') { q = true; started = true; continue; }
    if (c === ',') { endCell(); continue; }
    if (c === '\r') { if (s[i + 1] === '\n') i++; endRow(); continue; }
    if (c === '\n') { endRow(); continue; }
    cell += c; started = true;
    if (rows.length > MAX_ROWS) return { error: `Too many rows. Send up to ${MAX_ROWS} at a time.` };
  }
  if (q) return { error: 'A quote was opened and never closed. Check the file.' };
  if (cell !== '' || row.length) endRow();
  if (rows.length > MAX_ROWS + 1) return { error: `Too many rows. Send up to ${MAX_ROWS} at a time.` };
  if (rows.some((r) => r.length > MAX_COLS)) return { error: 'Too many columns.' };
  return { rows };
}
module.exports = { parse, MAX_BYTES, MAX_ROWS, MAX_COLS };
