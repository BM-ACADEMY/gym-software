'use strict';
// Vehicle records keyed by registration number (plate). Money is whole rupees, currency INR.
const CLASSES = ['bike', 'hatchback', 'sedan', 'suv', 'other'];
// Indian plates: state series (KA01AB1234, TN09Z1234) or Bharat series (22BH1234AA). Loose on purpose: owners type fast.
const STATE_PLATE = /^[A-Z]{2}\d{1,2}[A-Z]{0,3}\d{4}$/;
const BH_PLATE = /^\d{2}BH\d{4}[A-Z]{1,2}$/;
const normalizePlate = (raw) => String(raw || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
const validPlate = (raw) => { const p = normalizePlate(raw); return STATE_PLATE.test(p) || BH_PLATE.test(p); };
// Price by class plus add-ons. prices: { sedan: 400 }, addons: { wax: 150 }. Unknown class or add-on is an error, never a guess.
function quote(prices, addonPrices, klass, addonKeys = []) {
  if (!CLASSES.includes(klass)) return { error: 'Choose a vehicle class' };
  const base = prices && prices[klass];
  if (!Number.isInteger(base) || base < 0) return { error: 'No price set for this vehicle class' };
  let total = base; const lines = [{ key: klass, amount: base }];
  for (const k of addonKeys) {
    const a = addonPrices && addonPrices[k];
    if (!Number.isInteger(a) || a < 0) return { error: 'Unknown add-on: ' + k };
    lines.push({ key: k, amount: a }); total += a;
  }
  return { total, currency: 'INR', lines };
}
module.exports = { CLASSES, normalizePlate, validPlate, quote };
