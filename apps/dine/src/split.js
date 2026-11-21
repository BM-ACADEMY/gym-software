'use strict';
// Split a bill, whole rupees, so the parts always add up to the bill exactly (largest-remainder, from core-pos).
const { allocate } = require('../../../packages/core-pos/src/bill');
const bad = (m) => { const e = new Error(m); e.code = 'SPLIT_INVALID'; throw e; };

// Equal split between n guests. Any leftover rupees go to the first guests, one each.
function splitEqual(total, n) {
  if (!Number.isInteger(total) || total < 0) bad('Total must be a whole rupee amount.');
  if (!Number.isInteger(n) || n < 1 || n > 50) bad('Guests must be 1 to 50.');
  return allocate(total, Array(n).fill(1)).map((x, i) => x);
}
// By items. computed = result of core-pos bill.compute (lines with .total). assign[i] is a guest number, or an array of guest numbers sharing line i.
// extra = amount that has no line (service charge) shared in proportion to what each guest owes for items.
function splitByItems(computed, assign, guests, extra = 0) {
  if (!computed || !Array.isArray(computed.lines)) bad('Need a computed bill.');
  if (!Number.isInteger(guests) || guests < 1 || guests > 50) bad('Guests must be 1 to 50.');
  if (!Array.isArray(assign) || assign.length !== computed.lines.length) bad('Every line must be given to a guest.');
  const own = Array(guests).fill(0);
  assign.forEach((a, i) => {
    const who = Array.isArray(a) ? a : [a];
    if (!who.length || who.some((g) => !Number.isInteger(g) || g < 0 || g >= guests)) bad('Line ' + (i + 1) + ' has a wrong guest number.');
    if (new Set(who).size !== who.length) bad('Line ' + (i + 1) + ' lists the same guest twice.');
    allocate(computed.lines[i].total, who.map(() => 1)).forEach((share, k) => { own[who[k]] += share; });
  });
  const ex = allocate(extra, own);
  return own.map((v, g) => v + ex[g]);
}
// Service charge in whole rupees on the amount after discount and before GST. Whether GST applies on it, and whether it may be
// compulsory, is a CA / lawyer item (docs/products/dine/CA_LAWYER_ITEMS.md). Default off.
function serviceCharge(taxable, pct) {
  if (!Number.isInteger(taxable) || taxable < 0) bad('Amount must be whole rupees.');
  if (!Number.isFinite(pct) || pct < 0 || pct > 20) bad('Service charge must be 0 to 20 percent.');
  return Math.round((taxable * pct) / 100);
}
module.exports = { splitEqual, splitByItems, serviceCharge };
