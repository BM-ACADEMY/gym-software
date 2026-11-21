'use strict';
// GST rate by price per piece for READYMADE garments. The bands are DATA, not code, so Root Admin / the CA can change them.
// Source for the default (Fact, read 12 Nov 2026): busy.in/gst-rates/readymade-clothes: after 22 Sep 2025, up to Rs 2,500 per piece 5%, above 18%
// (before it was Rs 1,000 and 12%). NOT confirmed by our CA (needs M-04 style sign-off); HSN wording is a CA item and is not decided here.
// Fabric by metre, sarees and other categories are set per item by the owner; this helper never guesses them.
const DEFAULT_BANDS = { source: 'busy.in, 12 Nov 2026', needsCaConfirmation: true, bands: [{ upTo: 2500, rate: 5 }, { upTo: null, rate: 18 }] };
const SLABS = [0, 5, 12, 18, 28];
function validBands(b) {
  if (!Array.isArray(b) || !b.length) return false;
  let last = 0;
  for (let i = 0; i < b.length; i++) {
    const x = b[i]; if (!x || !SLABS.includes(x.rate)) return false;
    if (x.upTo === null) { if (i !== b.length - 1) return false; } else { if (!Number.isInteger(x.upTo) || x.upTo <= last) return false; last = x.upTo; }
  }
  return b[b.length - 1].upTo === null;
}
// price: selling price per piece in whole rupees (before GST). Returns the rate or null when the price is invalid.
function rateFor(price, config = DEFAULT_BANDS) {
  const bands = config && config.bands; if (!validBands(bands) || !Number.isInteger(price) || price < 0) return null;
  return bands.find((x) => x.upTo === null || price <= x.upTo).rate;
}
module.exports = { DEFAULT_BANDS, SLABS, validBands, rateFor };
