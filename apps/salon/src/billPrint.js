'use strict';
// Printable bill for the Salon: A5 or A4 HTML that the browser prints to paper or PDF. Uses the shared core-pos page (escapes everything, no script).
// Staff see the customer's phone masked; the owner sees it in full.
const billHtml = require('../../../packages/core-pos/src/billHtml');
const B = require('./booking');
const SIZES = ['A4', 'A5'];
function render({ bill, tenant, customer, role, size, cashier, at }) {
  const sz = SIZES.includes(String(size || '').toUpperCase()) ? String(size).toUpperCase() : 'A5';
  const shop = { name: tenant.businessName, address: tenant.address || '', phone: tenant.phone || '', gstin: tenant.gstin || '', footer: 'Thank you. Please visit again.' };
  const phone = customer && customer.phone ? (role === 'admin' ? customer.phone : B.maskPhone(customer.phone)) : '';
  return billHtml.render(bill, shop, { size: sz, at, cashier: cashier || '', customerName: customer && !customer.anonymisedAt ? customer.name : '', customerPhone: customer && !customer.anonymisedAt ? phone : '' });
}
module.exports = { render, SIZES };
