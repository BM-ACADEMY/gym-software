'use strict';
// GST handling for Dine lines. This file does NOT decide the legal treatment; it applies whichever profile the owner (and their CA) chose.
// Profiles (each is a SUGGESTED starting point, flagged confirmedByCA:false until a CA writes it down; see CA_LAWYER_ITEMS.md):
//  - per_item: every line uses the rate on the menu item (default 5 when blank).
//  - flat_5: every food and drink line is billed at 5 percent (the common restaurant case the scope mentions; CA to confirm conditions such as no input tax credit).
//  - none: plain bill, no GST (owner not registered).
// Liquor lines are NEVER given a GST rate by this app: they use 0 and carry stateTax:'owner' so the owner enters whatever state VAT or excise
// treatment applies. No excise report or register is produced (scope section 4.6).
const PROFILES = { per_item: { label: 'Rate from each item', confirmedByCA: false }, flat_5: { label: 'Flat 5 percent on food and drinks', confirmedByCA: false }, none: { label: 'Plain bill, no GST', confirmedByCA: true } };
const bad = (m) => { const e = new Error(m); e.code = 'GST_INVALID'; throw e; };
function profileFor(profile) { if (!PROFILES[profile]) bad('Unknown GST profile.'); return { key: profile, ...PROFILES[profile] }; }
// Turns order lines into the lines core-pos bill.compute wants, plus the taxMode to pass.
function toBillInput(lines, profile) {
  profileFor(profile);
  const taxMode = profile === 'none' ? 'none' : 'gst_exclusive'; // menu prices exclude GST; the owner can switch to inclusive in settings (not built yet)
  return {
    taxMode,
    lines: lines.map((l) => {
      const liquor = l.kind === 'liquor';
      const rate = profile === 'none' || liquor ? 0 : profile === 'flat_5' ? 5 : (l.gstRate === undefined ? 5 : l.gstRate);
      return { name: l.name, unitPrice: l.unitPrice, qty: l.qty, gstRate: rate, itemId: l.itemId || null, kind: l.kind || 'food', ...(liquor ? { stateTax: 'owner' } : {}) };
    }),
  };
}
module.exports = { PROFILES, profileFor, toBillInput };
