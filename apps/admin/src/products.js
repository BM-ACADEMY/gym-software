'use strict';
// The seven products shown in Super Admin, in the order the owner sees them. Counts only: no customer data comes through here.
// Each product's address and key come from the admin server's environment (never git), same names as collect.js:
//   ADMIN_URL_<PRODUCT>=https://...   ADMIN_KEY_<PRODUCT>=<that product's INTERNAL_API_KEY, 24+ characters>
// A product that has no address or key yet is listed as "not connected", which is not an error.
const PRODUCTS = [
  { key: 'gym', label: 'Fit (gym)' }, { key: 'salon', label: 'Groom (salon, spa, barber, clinic)' }, { key: 'mart', label: 'Mart' },
  { key: 'dine', label: 'Dine' }, { key: 'cloth', label: 'Cloth' }, { key: 'wash', label: 'Wash' }, { key: 'hire', label: 'Hire' },
];
const productKeys = () => PRODUCTS.map((p) => p.key);
const labelOf = (key) => (PRODUCTS.find((p) => p.key === key) || { label: String(key || '') }).label;
// Config for all seven: the products named in ADMIN_PRODUCTS (if set) are read as before; every other known product is added
// with no address, so the screen lists it as "not connected" instead of leaving it out.
function readAllConfig(env = process.env, readConfig = require('./collect').readConfig) {
  const set = readConfig(env); const have = new Set(set.map((c) => c.product));
  const rest = productKeys().filter((k) => !have.has(k)).map((k) => ({ product: k, url: null, key: null }));
  const order = productKeys();
  return [...set, ...rest].sort((a, b) => (order.indexOf(a.product) + 100 * (order.indexOf(a.product) < 0)) - (order.indexOf(b.product) + 100 * (order.indexOf(b.product) < 0)));
}
module.exports = { PRODUCTS, productKeys, labelOf, readAllConfig };
