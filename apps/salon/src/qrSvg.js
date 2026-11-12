'use strict';
// Pure-JS QR code (byte mode, error correction level M, versions 1 to 10) written as SVG. No packages, no network.
// Used for the shop's booking-link poster. Written, checked by decoding with an image reader; not yet scanned by a person's phone.
const EXP = new Array(512); const LOG = new Array(256);
(() => { let x = 1; for (let i = 0; i < 255; i += 1) { EXP[i] = x; LOG[x] = i; x <<= 1; if (x & 256) x ^= 0x11d; } for (let i = 255; i < 512; i += 1) EXP[i] = EXP[i - 255]; })();
const gmul = (a, b) => (a === 0 || b === 0 ? 0 : EXP[LOG[a] + LOG[b]]);

// Level M: error-correction codewords per block, and block count, for versions 1..10 (index 0 = version 1).
const EC_PER_BLOCK = [10, 16, 26, 18, 24, 16, 18, 22, 22, 26];
const BLOCKS = [1, 1, 1, 2, 2, 4, 4, 4, 5, 5];
// Total codewords per version (data + error correction).
const TOTAL = [26, 44, 70, 100, 134, 172, 196, 242, 292, 346];
const ALIGN = [[], [6, 18], [6, 22], [6, 26], [6, 30], [6, 34], [6, 22, 38], [6, 24, 42], [6, 26, 46], [6, 28, 50]];

function rsGenerator(n) { let g = [1]; for (let i = 0; i < n; i += 1) { const next = new Array(g.length + 1).fill(0); for (let j = 0; j < g.length; j += 1) { next[j] ^= g[j]; next[j + 1] ^= gmul(g[j], EXP[i]); } g = next; } return g; }
function rsRemainder(data, n) { const g = rsGenerator(n); const res = new Array(n).fill(0); for (const d of data) { const f = d ^ res[0]; res.shift(); res.push(0); if (f) for (let i = 0; i < n; i += 1) res[i] ^= gmul(g[i + 1], f); } return res; }

function dataCapacity(v) { return TOTAL[v - 1] - EC_PER_BLOCK[v - 1] * BLOCKS[v - 1]; }
function pickVersion(len) { for (let v = 1; v <= 10; v += 1) { const bits = 4 + (v < 10 ? 8 : 16) + len * 8; if (Math.ceil(bits / 8) <= dataCapacity(v)) return v; } throw new Error('Link is too long for the booking code.'); }

function makeCodewords(bytes, v) {
  const bits = []; const put = (val, n) => { for (let i = n - 1; i >= 0; i -= 1) bits.push((val >>> i) & 1); };
  put(4, 4); put(bytes.length, v < 10 ? 8 : 16); bytes.forEach((b) => put(b, 8));
  const cap = dataCapacity(v) * 8; put(0, Math.min(4, cap - bits.length)); while (bits.length % 8) bits.push(0);
  const data = []; for (let i = 0; i < bits.length; i += 8) data.push(parseInt(bits.slice(i, i + 8).join(''), 2));
  for (let pad = 0xec; data.length < dataCapacity(v); pad ^= 0xec ^ 0x11) data.push(pad);
  const nb = BLOCKS[v - 1]; const ec = EC_PER_BLOCK[v - 1]; const total = TOTAL[v - 1]; const dataTotal = total - ec * nb;
  const short = Math.floor(dataTotal / nb); const longCount = dataTotal % nb; const blocks = []; let pos = 0;
  for (let i = 0; i < nb; i += 1) { const len = short + (i >= nb - longCount ? 1 : 0); const d = data.slice(pos, pos + len); pos += len; blocks.push({ d, e: rsRemainder(d, ec) }); }
  const out = []; const maxLen = short + (longCount ? 1 : 0);
  for (let i = 0; i < maxLen; i += 1) for (const b of blocks) if (i < b.d.length) out.push(b.d[i]);
  for (let i = 0; i < ec; i += 1) for (const b of blocks) out.push(b.e[i]);
  return out;
}

function formatBits(mask) { const data = (0 << 3) | mask; /* level M = 00 */ let rem = data << 10; for (let i = 14; i >= 10; i -= 1) if ((rem >>> i) & 1) rem ^= 0x537 << (i - 10); return ((data << 10) | rem) ^ 0x5412; }
function versionBits(v) { let rem = v << 12; for (let i = 17; i >= 12; i -= 1) if ((rem >>> i) & 1) rem ^= 0x1f25 << (i - 12); return (v << 12) | rem; }

const MASKS = [(r, c) => (r + c) % 2 === 0, (r) => r % 2 === 0, (r, c) => c % 3 === 0, (r, c) => (r + c) % 3 === 0, (r, c) => (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0,
  (r, c) => ((r * c) % 2) + ((r * c) % 3) === 0, (r, c) => (((r * c) % 2) + ((r * c) % 3)) % 2 === 0, (r, c) => (((r + c) % 2) + ((r * c) % 3)) % 2 === 0];

function build(bytes) {
  const v = pickVersion(bytes.length); const size = 17 + 4 * v; const code = makeCodewords(bytes, v);
  const mods = Array.from({ length: size }, () => new Array(size).fill(false)); const fn = Array.from({ length: size }, () => new Array(size).fill(false));
  const set = (r, c, val) => { mods[r][c] = val; fn[r][c] = true; };
  const finder = (r0, c0) => { for (let dr = -1; dr <= 7; dr += 1) for (let dc = -1; dc <= 7; dc += 1) { const r = r0 + dr; const c = c0 + dc; if (r < 0 || c < 0 || r >= size || c >= size) continue; const on = dr >= 0 && dr <= 6 && dc >= 0 && dc <= 6 && (dr === 0 || dr === 6 || dc === 0 || dc === 6 || (dr >= 2 && dr <= 4 && dc >= 2 && dc <= 4)); set(r, c, on); } };
  finder(0, 0); finder(0, size - 7); finder(size - 7, 0);
  for (let i = 8; i < size - 8; i += 1) { set(6, i, i % 2 === 0); set(i, 6, i % 2 === 0); }
  const al = ALIGN[v - 1];
  for (const r of al) for (const c of al) { if ((r === 6 && c === 6) || (r === 6 && c === al[al.length - 1]) || (r === al[al.length - 1] && c === 6)) continue; for (let dr = -2; dr <= 2; dr += 1) for (let dc = -2; dc <= 2; dc += 1) set(r + dr, c + dc, Math.max(Math.abs(dr), Math.abs(dc)) !== 1); }
  // reserve format and version areas
  for (let i = 0; i < 9; i += 1) { fn[8][i] = true; fn[i][8] = true; }
  for (let i = 0; i < 8; i += 1) { fn[8][size - 1 - i] = true; fn[size - 1 - i][8] = true; }
  set(size - 8, 8, true);
  if (v >= 7) for (let i = 0; i < 18; i += 1) { fn[Math.floor(i / 3)][size - 11 + (i % 3)] = true; fn[size - 11 + (i % 3)][Math.floor(i / 3)] = true; }
  // place data
  const bits = []; code.forEach((b) => { for (let i = 7; i >= 0; i -= 1) bits.push((b >>> i) & 1); });
  let k = 0; let up = true;
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let n = 0; n < size; n += 1) { const r = up ? size - 1 - n : n; for (let j = 0; j < 2; j += 1) { const c = right - j; if (fn[r][c]) continue; mods[r][c] = k < bits.length ? bits[k] === 1 : false; k += 1; } }
    up = !up;
  }
  const finish = (mask) => {
    const m = mods.map((row) => row.slice());
    for (let r = 0; r < size; r += 1) for (let c = 0; c < size; c += 1) if (!fn[r][c] && MASKS[mask](r, c)) m[r][c] = !m[r][c];
    const fb = formatBits(mask); const bit = (i) => ((fb >>> i) & 1) === 1;
    for (let i = 0; i <= 5; i += 1) m[i][8] = bit(i);
    m[7][8] = bit(6); m[8][8] = bit(7); m[8][7] = bit(8);
    for (let i = 9; i < 15; i += 1) m[8][14 - i] = bit(i);
    for (let i = 0; i < 8; i += 1) m[8][size - 1 - i] = bit(i);
    for (let i = 8; i < 15; i += 1) m[size - 15 + i][8] = bit(i);
    m[size - 8][8] = true;
    if (v >= 7) { const vb = versionBits(v); for (let i = 0; i < 18; i += 1) { const on = ((vb >>> i) & 1) === 1; m[Math.floor(i / 3)][size - 11 + (i % 3)] = on; m[size - 11 + (i % 3)][Math.floor(i / 3)] = on; } }
    return m;
  };
  const penalty = (m) => {
    let p = 0;
    for (let a = 0; a < size; a += 1) for (const horiz of [true, false]) {
      let run = 1; for (let b = 1; b < size; b += 1) { const cur = horiz ? m[a][b] : m[b][a]; const prev = horiz ? m[a][b - 1] : m[b - 1][a]; if (cur === prev) { run += 1; if (run === 5) p += 3; else if (run > 5) p += 1; } else run = 1; }
    }
    for (let r = 0; r < size - 1; r += 1) for (let c = 0; c < size - 1; c += 1) if (m[r][c] === m[r][c + 1] && m[r][c] === m[r + 1][c] && m[r][c] === m[r + 1][c + 1]) p += 3;
    const pat = [true, false, true, true, true, false, true, false, false, false, false]; const rev = pat.slice().reverse();
    for (let a = 0; a < size; a += 1) for (let b = 0; b + 11 <= size; b += 1) for (const horiz of [true, false]) {
      const get = (i) => (horiz ? m[a][b + i] : m[b + i][a]); if (pat.every((x, i) => get(i) === x)) p += 40; if (rev.every((x, i) => get(i) === x)) p += 40;
    }
    let dark = 0; for (const row of m) for (const x of row) if (x) dark += 1; p += Math.floor(Math.abs((dark * 100) / (size * size) - 50) / 5) * 10;
    return p;
  };
  let best = null; let bestP = Infinity;
  for (let mask = 0; mask < 8; mask += 1) { const m = finish(mask); const p = penalty(m); if (p < bestP) { bestP = p; best = m; } }
  return best;
}

// Returns the module grid (array of rows of true/false) for a piece of text.
function qrMatrix(text) { return build(Array.from(Buffer.from(String(text), 'utf8'))); }
// Returns a small SVG picture (black on white, 4-module quiet zone). `scale` is the pixel size of one module.
function qrSvg(text, scale = 8) {
  const m = qrMatrix(text); const n = m.length; const q = 4; const dim = (n + q * 2) * scale; const rects = [];
  for (let r = 0; r < n; r += 1) { let c = 0; while (c < n) { if (!m[r][c]) { c += 1; continue; } let e = c; while (e < n && m[r][e]) e += 1; rects.push(`M${(c + q) * scale} ${(r + q) * scale}h${(e - c) * scale}v${scale}h${-(e - c) * scale}z`); c = e; } }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${dim}" height="${dim}" viewBox="0 0 ${dim} ${dim}" role="img" aria-label="Booking QR code"><rect width="${dim}" height="${dim}" fill="#fff"/><path d="${rects.join('')}" fill="#000"/></svg>`;
}
module.exports = { qrMatrix, qrSvg };
