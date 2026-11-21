'use strict';
// Dine menu rules. Pure: no database, no clock. Money is whole rupees with a currency code (INR) kept on the item.
// Item: { key, name, category, price, gstRate, kind: 'food'|'drink'|'liquor', station: 'kitchen'|'bar', variants:[{key,name,price}], groups:[{key,name,min,max,options:[{key,name,price}]}] }
// A variant REPLACES the base price; modifier options ADD to it. GST rates are the owner's entry; see docs/products/dine/CA_LAWYER_ITEMS.md.
const { GST_SLABS } = require('../../../packages/core-pos/src/bill');
const KINDS = ['food', 'drink', 'liquor'];
const STATIONS = ['kitchen', 'bar'];
const wholeRs = (n) => Number.isInteger(n) && n >= 0 && n <= 1000000;
const bad = (m) => { const e = new Error(m); e.code = 'MENU_INVALID'; throw e; };

function checkItem(it) {
  if (!it || typeof it !== 'object') bad('Item missing.');
  if (typeof it.key !== 'string' || !it.key) bad('Item needs a key.');
  if (typeof it.name !== 'string' || it.name.trim().length < 1 || it.name.length > 120) bad('Item needs a name of 1 to 120 characters.');
  if (!wholeRs(it.price)) bad('Price must be a whole rupee amount.');
  if (!GST_SLABS.includes(it.gstRate === undefined ? 5 : it.gstRate)) bad('GST rate must be a standard slab.');
  if (it.kind !== undefined && !KINDS.includes(it.kind)) bad('Kind must be food, drink or liquor.');
  if (it.station !== undefined && !STATIONS.includes(it.station)) bad('Station must be kitchen or bar.');
  for (const v of it.variants || []) { if (!v.key || !wholeRs(v.price)) bad('Each variant needs a key and a whole-rupee price.'); }
  for (const g of it.groups || []) {
    if (!g.key || !Array.isArray(g.options) || !g.options.length) bad('Each modifier group needs options.');
    const min = g.min || 0; const max = g.max === undefined ? g.options.length : g.max;
    if (!Number.isInteger(min) || !Number.isInteger(max) || min < 0 || max < min || max > g.options.length) bad('Modifier group min and max are not valid.');
    for (const o of g.options) if (!o.key || !wholeRs(o.price || 0)) bad('Each option needs a key and a whole-rupee price.');
  }
  return true;
}
// order line choice: { variantKey?, optionKeys: [] , qty }. Returns the unit price, the display name and the KOT note.
function priceLine(item, choice = {}) {
  checkItem(item);
  const qty = Number(choice.qty);
  if (!Number.isInteger(qty) || qty < 1 || qty > 99) bad('Quantity must be a whole number from 1 to 99.');
  let unit = item.price; let label = item.name; const notes = [];
  if ((item.variants || []).length) {
    const v = item.variants.find((x) => x.key === choice.variantKey);
    if (!v) bad('Choose a size or variant.');
    unit = v.price; label += ' (' + v.name + ')';
  } else if (choice.variantKey) bad('This item has no variants.');
  const picked = new Set(choice.optionKeys || []);
  const seen = new Set();
  for (const g of item.groups || []) {
    const chosen = g.options.filter((o) => picked.has(o.key));
    chosen.forEach((o) => seen.add(o.key));
    const min = g.min || 0; const max = g.max === undefined ? g.options.length : g.max;
    if (chosen.length < min) bad('Choose at least ' + min + ' for ' + g.name + '.');
    if (chosen.length > max) bad('Choose at most ' + max + ' for ' + g.name + '.');
    chosen.forEach((o) => { unit += o.price || 0; notes.push(o.name); });
  }
  if ([...picked].some((k) => !seen.has(k))) bad('An add-on is not on this item.');
  return { unitPrice: unit, qty, name: label, note: notes.join(', '), gstRate: item.gstRate === undefined ? 5 : item.gstRate, kind: item.kind || 'food', station: item.station || (item.kind === 'liquor' ? 'bar' : 'kitchen'), currency: item.currency || 'INR' };
}
module.exports = { checkItem, priceLine, KINDS, STATIONS };
