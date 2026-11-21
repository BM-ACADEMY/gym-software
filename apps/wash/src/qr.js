'use strict';
// Small QR code maker (byte mode, error correction L or M, versions 1 to 20, so up to about 600 characters) with SVG output.
// No dependencies, no network. Used for the UPI payment link and, in Wash, the booking link.
// Written 13 Nov. Checked by decoding the output with an independent QR reader (see tests/qr.test.js notes); not yet tested by a person.
// The same file lives in apps/wash/src/qr.js. When a shared package is allowed, move it to packages/ and delete the copies.
const ECC_PER_BLOCK = { L: [-1, 7, 10, 15, 20, 26, 18, 20, 24, 30, 18, 20, 24, 26, 30, 22, 24, 28, 30, 28, 28], M: [-1, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26, 30, 22, 22, 24, 24, 28, 28, 26, 26, 26] };
const NUM_BLOCKS = { L: [-1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 4, 4, 4, 4, 4, 6, 6, 6, 6, 7, 8], M: [-1, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5, 5, 8, 9, 9, 10, 10, 11, 13, 14, 16] };
const FORMAT_BITS = { L: 1, M: 0 }; const MAX_VERSION = 20;

const bit = (x, i) => ((x >>> i) & 1) !== 0;
const rawModules = (v) => { let r = (16 * v + 128) * v + 64; if (v >= 2) { const a = Math.floor(v / 7) + 2; r -= (25 * a - 10) * a - 55; if (v >= 7) r -= 36; } return r; };
const dataCodewords = (v, e) => Math.floor(rawModules(v) / 8) - ECC_PER_BLOCK[e][v] * NUM_BLOCKS[e][v];
const alignPositions = (v) => { if (v === 1) return []; const n = Math.floor(v / 7) + 2; const size = v * 4 + 17; const step = Math.ceil((v * 4 + 4) / (n * 2 - 2)) * 2; const r = [6]; for (let p = size - 7; r.length < n; p -= step) r.splice(1, 0, p); return r; };

// Reed-Solomon over GF(256), polynomial 0x11D.
const gfMul = (x, y) => { let z = 0; for (let i = 7; i >= 0; i--) { z = (z << 1) ^ ((z >>> 7) * 0x11d); z ^= ((y >>> i) & 1) * x; } return z & 0xff; };
const rsDivisor = (deg) => { const r = new Array(deg).fill(0); r[deg - 1] = 1; let root = 1; for (let i = 0; i < deg; i++) { for (let j = 0; j < r.length; j++) { r[j] = gfMul(r[j], root); if (j + 1 < r.length) r[j] ^= r[j + 1]; } root = gfMul(root, 0x02); } return r; };
const rsRemainder = (data, div) => { const r = new Array(div.length).fill(0); for (const b of data) { const f = b ^ r.shift(); r.push(0); div.forEach((c, i) => { r[i] ^= gfMul(c, f); }); } return r; };

function pickVersion(len, ecl) {
  for (let v = 1; v <= MAX_VERSION; v++) { const need = 4 + (v < 10 ? 8 : 16) + len * 8; if (need <= dataCodewords(v, ecl) * 8) return v; }
  return 0;
}
function encodeData(bytes, v, ecl) {
  const bits = []; const put = (val, n) => { for (let i = n - 1; i >= 0; i--) bits.push((val >>> i) & 1); };
  put(0b0100, 4); put(bytes.length, v < 10 ? 8 : 16); bytes.forEach((b) => put(b, 8));
  const cap = dataCodewords(v, ecl) * 8; put(0, Math.min(4, cap - bits.length)); put(0, (8 - (bits.length % 8)) % 8);
  const out = []; for (let i = 0; i < bits.length; i += 8) out.push(parseInt(bits.slice(i, i + 8).join(''), 2));
  for (let pad = 0xec; out.length < cap / 8; pad ^= 0xec ^ 0x11) out.push(pad);
  return out;
}
function addEccAndInterleave(data, v, ecl) {
  const nb = NUM_BLOCKS[ecl][v]; const eccLen = ECC_PER_BLOCK[ecl][v]; const raw = Math.floor(rawModules(v) / 8);
  const short = nb - (raw % nb); const shortLen = Math.floor(raw / nb); const div = rsDivisor(eccLen); const blocks = []; let k = 0;
  for (let i = 0; i < nb; i++) { const dat = data.slice(k, k + shortLen - eccLen + (i < short ? 0 : 1)); k += dat.length; const ecc = rsRemainder(dat, div); if (i < short) dat.push(0); blocks.push(dat.concat(ecc)); }
  const out = []; for (let i = 0; i < blocks[0].length; i++) blocks.forEach((b, j) => { if (i !== shortLen - eccLen || j >= short) out.push(b[i]); });
  return out;
}
const MASKS = [(x, y) => (x + y) % 2 === 0, (x, y) => y % 2 === 0, (x, y) => x % 3 === 0, (x, y) => (x + y) % 3 === 0, (x, y) => (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0,
  (x, y) => ((x * y) % 2) + ((x * y) % 3) === 0, (x, y) => (((x * y) % 2) + ((x * y) % 3)) % 2 === 0, (x, y) => (((x + y) % 2) + ((x * y) % 3)) % 2 === 0];

function penalty(m) {
  const n = m.length; let p = 0;
  const line = (get) => { for (let a = 0; a < n; a++) { let run = 1; for (let b = 1; b <= n; b++) { if (b < n && get(a, b) === get(a, b - 1)) run++; else { if (run >= 5) p += run - 2; run = 1; } }
    for (let b = 0; b + 11 <= n; b++) { const s = []; for (let i = 0; i < 11; i++) s.push(get(a, b + i) ? 1 : 0); const j = s.join(''); if (j === '10111010000' || j === '00001011101') p += 40; } } };
  line((y, x) => m[y][x]); line((x, y) => m[y][x]);
  for (let y = 0; y < n - 1; y++) for (let x = 0; x < n - 1; x++) if (m[y][x] === m[y][x + 1] && m[y][x] === m[y + 1][x] && m[y][x] === m[y + 1][x + 1]) p += 3;
  let dark = 0; for (const row of m) for (const c of row) if (c) dark++; p += Math.floor(Math.abs(dark * 20 - n * n * 10) / (n * n)) * 10;
  return p;
}

function build(allData, v, ecl, mask) {
  const size = v * 4 + 17; const m = Array.from({ length: size }, () => new Array(size).fill(false)); const fn = Array.from({ length: size }, () => new Array(size).fill(false));
  const set = (x, y, c) => { m[y][x] = c; fn[y][x] = true; };
  for (let i = 0; i < size; i++) { set(6, i, i % 2 === 0); set(i, 6, i % 2 === 0); }
  const finder = (cx, cy) => { for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) { const d = Math.max(Math.abs(dx), Math.abs(dy)); const x = cx + dx; const y = cy + dy; if (x >= 0 && x < size && y >= 0 && y < size) set(x, y, d !== 2 && d !== 4); } };
  finder(3, 3); finder(size - 4, 3); finder(3, size - 4);
  const ap = alignPositions(v); const n = ap.length;
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) { if ((i === 0 && j === 0) || (i === 0 && j === n - 1) || (i === n - 1 && j === 0)) continue; for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) set(ap[i] + dx, ap[j] + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1); }
  const drawFormat = (mk) => {
    const d = (FORMAT_BITS[ecl] << 3) | mk; let r = d; for (let i = 0; i < 10; i++) r = (r << 1) ^ ((r >>> 9) * 0x537); const bits = ((d << 10) | r) ^ 0x5412;
    for (let i = 0; i <= 5; i++) set(8, i, bit(bits, i)); set(8, 7, bit(bits, 6)); set(8, 8, bit(bits, 7)); set(7, 8, bit(bits, 8)); for (let i = 9; i < 15; i++) set(14 - i, 8, bit(bits, i));
    for (let i = 0; i < 8; i++) set(size - 1 - i, 8, bit(bits, i)); for (let i = 8; i < 15; i++) set(8, size - 15 + i, bit(bits, i)); set(8, size - 8, true);
  };
  drawFormat(0);
  if (v >= 7) { let r = v; for (let i = 0; i < 12; i++) r = (r << 1) ^ ((r >>> 11) * 0x1f25); const bits = (v << 12) | r; for (let i = 0; i < 18; i++) { const a = size - 11 + (i % 3); const b = Math.floor(i / 3); set(a, b, bit(bits, i)); set(b, a, bit(bits, i)); } }
  let i = 0;
  for (let right = size - 1; right >= 1; right -= 2) { if (right === 6) right = 5;
    for (let vert = 0; vert < size; vert++) for (let j = 0; j < 2; j++) { const x = right - j; const up = ((right + 1) & 2) === 0; const y = up ? size - 1 - vert : vert; if (!fn[y][x] && i < allData.length * 8) { m[y][x] = bit(allData[i >>> 3], 7 - (i & 7)); i++; } } }
  if (mask < 0) { let best = 0; let bestP = Infinity; for (let k = 0; k < 8; k++) { const t = build(allData, v, ecl, k); const p = penalty(t.modules); if (p < bestP) { bestP = p; best = k; } } return build(allData, v, ecl, best); }
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) if (!fn[y][x] && MASKS[mask](x, y)) m[y][x] = !m[y][x];
  drawFormat(mask);
  return { modules: m, size, version: v, mask };
}

// makeQr('upi://pay?...', 'M') -> { size, version, modules[y][x] (true = dark) }. Throws a plain message when the text is too long.
function makeQr(text, ecl = 'M', mask = -1) {
  if (!ECC_PER_BLOCK[ecl]) throw new Error('Error correction must be L or M.');
  if (typeof text !== 'string' || !text.length) throw new Error('Nothing to put in the QR code.');
  const bytes = [...Buffer.from(text, 'utf8')]; const v = pickVersion(bytes.length, ecl);
  if (!v) throw new Error('That text is too long for a QR code.');
  return build(addEccAndInterleave(encodeData(bytes, v, ecl), v, ecl), v, ecl, mask);
}
// One <path> of squares, white background and a 4-module quiet zone. No scripts, no external links, safe to serve as image/svg+xml.
function qrSvg(text, { ecl = 'M', scale = 6, border = 4 } = {}) {
  const q = makeQr(text, ecl); const dim = q.size + border * 2; let d = '';
  for (let y = 0; y < q.size; y++) for (let x = 0; x < q.size; x++) if (q.modules[y][x]) d += `M${x + border},${y + border}h1v1h-1z`;
  const px = dim * Math.max(1, Math.min(20, Math.floor(scale)));
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${dim} ${dim}" width="${px}" height="${px}" shape-rendering="crispEdges"><rect width="${dim}" height="${dim}" fill="#fff"/><path d="${d}" fill="#000"/></svg>`;
}
// How many bytes of text fit in a version (used by the checks).
const capacity = (v, ecl = 'M') => Math.floor((dataCodewords(v, ecl) * 8 - 4 - (v < 10 ? 8 : 16)) / 8);
module.exports = { makeQr, qrSvg, capacity, MAX_VERSION };
