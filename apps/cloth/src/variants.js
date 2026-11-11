'use strict';
// Variants: one style, many sizes and colours. Pure functions. Money is whole rupees with a currency code (INR).
const clean = (s, max = 30) => String(s == null ? '' : s).trim().slice(0, max);
const slug = (s) => clean(s).toUpperCase().replace(/[^A-Z0-9]+/g, '-').replace(/^-|-$/g, '');
const key = (style, size, colour) => [slug(style), slug(size), slug(colour)].join('/');

// styleCode "SH-101", sizes ["S","M"], colours ["Blue","Red"] -> one row per size x colour. Duplicates in the input collapse.
// A grid of more than 200 variants is refused (a typing mistake is more likely than a real range).
function buildGrid({ style, sizes, colours, mrp, cost, currency = 'INR' }) {
  const st = clean(style, 40); if (st.length < 1) return { error: 'Enter a style or design name.' };
  const uniq = (a) => [...new Set((Array.isArray(a) ? a : []).map((x) => clean(x)).filter(Boolean))];
  const sz = uniq(sizes), co = uniq(colours);
  if (!sz.length || !co.length) return { error: 'Add at least one size and one colour.' };
  if (sz.length * co.length > 200) return { error: 'That is more than 200 variants at once. Add the style in parts.' };
  if (!Number.isInteger(mrp) || mrp < 1) return { error: 'MRP must be a whole rupee amount.' };
  if (cost != null && (!Number.isInteger(cost) || cost < 0)) return { error: 'Cost must be a whole rupee amount.' };
  const rows = [];
  for (const s of sz) for (const c of co) rows.push({ style: st, size: s, colour: c, key: key(st, s, c), mrp, cost: cost == null ? undefined : cost, currency, qty: 0 });
  return { rows };
}

// Size gaps: sizes that sold in the last window but are now at zero, while other sizes of the same style still hold stock.
// variants: [{style,size,colour,qty}], soldBySize: { 'STYLE/SIZE': unitsSold } built by the caller from recent bills.
function sizeGaps(variants, sold = {}) {
  const byStyle = {};
  for (const v of variants || []) { (byStyle[v.style] = byStyle[v.style] || []).push(v); }
  const out = [];
  for (const [style, list] of Object.entries(byStyle)) {
    const total = list.reduce((a, v) => a + Math.max(0, v.qty), 0);
    if (total <= 0) continue;
    const sizes = [...new Set(list.map((v) => v.size))];
    for (const size of sizes) {
      const have = list.filter((v) => v.size === size).reduce((a, v) => a + Math.max(0, v.qty), 0);
      const sales = sold[slug(style) + '/' + slug(size)] || 0;
      if (have === 0 && sales > 0) out.push({ style, size, sold: sales, stockElsewhere: total });
    }
  }
  return out.sort((a, b) => b.sold - a.sold);
}
const totalQty = (variants) => (variants || []).reduce((a, v) => a + Math.max(0, v.qty || 0), 0);
const stockValueAtCost = (variants) => (variants || []).reduce((a, v) => a + Math.max(0, v.qty || 0) * (v.cost || 0), 0);
module.exports = { slug, key, buildGrid, sizeGaps, totalQty, stockValueAtCost };
