'use strict';
// CLO-13: a real Code 128 barcode as SVG, in plain JavaScript (no library). Subset B: letters, digits and punctuation (ASCII 32 to 126).
// Pure. Written, not yet tested by a person: scan a printed label with a real scanner before trusting it (Dev A step).
// Each pattern is bar, space, bar, space, bar, space widths in modules; every symbol is 11 modules wide, the stop is 13.
const P = ['212222','222122','222221','121223','121322','131222','122213','122312','132212','221213','221312','231212','112232','122132','122231','113222','123122','123221','223211','221132','221231','213212','223112','312131','311222','321122','321221','312212','322112','322211','212123','212321','232121','111323','131123','131321','112313','132113','132311','211313','231113','231311','112133','112331','132131','113123','113321','133121','313121','211331','231131','213113','213311','213131','311123','311321','331121','312113','312311','332111','314111','221411','431111','111224','111422','121124','121421','141122','141221','112214','112412','122114','122411','142112','142211','241211','221114','413111','241112','134111','111242','121142','121241','114212','124112','124211','411212','421112','421211','212141','214121','412121','111143','111341','131141','114113','114311','411113','411311','113141','114131','311141','411131','211412','211214','211232'];
const STOP = '2331112'; const START_B = 104; const MAX_LEN = 40;
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const printable = (t) => typeof t === 'string' && t.length > 0 && t.length <= MAX_LEN && /^[\x20-\x7e]+$/.test(t);

// Symbol values: start B, one value per character (code - 32), check symbol, stop.
function values(text) {
  if (!printable(text)) return null;
  const v = [START_B]; for (const ch of text) v.push(ch.charCodeAt(0) - 32);
  const check = v.reduce((sum, x, i) => sum + (i === 0 ? x : x * i), 0) % 103;
  v.push(check); return v;
}
// Bar and space widths (modules), first one is a bar.
function widths(text) { const v = values(text); if (!v) return null; return v.map((x) => P[x]).join('') + STOP; }
const totalModules = (w) => [...w].reduce((a, d) => a + Number(d), 0);

// SVG with a 10-module quiet zone each side. The text under the bars is escaped.
function svg(text, { moduleWidth = 2, height = 50, showText = true } = {}) {
  const w = widths(text); if (!w) return '';
  const q = 10 * moduleWidth; let x = q; let bars = '';
  [...w].forEach((d, i) => { const len = Number(d) * moduleWidth; if (i % 2 === 0) bars += `<rect x="${x}" y="0" width="${len}" height="${height}"/>`; x += len; });
  const W = x + q; const H = height + (showText ? 14 : 0);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="Barcode ${esc(text)}"><rect width="${W}" height="${H}" fill="#fff"/><g fill="#000">${bars}</g>${showText ? `<text x="${W / 2}" y="${height + 11}" font-family="monospace" font-size="11" text-anchor="middle">${esc(text)}</text>` : ''}</svg>`;
}
module.exports = { P, STOP, printable, values, widths, totalModules, svg, MAX_LEN };
