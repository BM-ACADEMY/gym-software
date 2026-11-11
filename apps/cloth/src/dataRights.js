'use strict';
// CLO-10: data export and delete on request (DPDP-style; the lawyer still reviews the wording, M-15). Pure. Written, not yet tested by a person.
// Delete = anonymise the person but keep the bill rows, because the shop must keep its tax and sales records and the money must add up.
const CAP = 5000;
const pick = (o, keys) => keys.reduce((a, k) => (o && o[k] !== undefined && o[k] !== null ? { ...a, [k]: o[k] } : a), {});
const strip = (rows, keys) => (rows || []).slice(0, CAP).map((r) => pick(r, keys));
const SECRET_KEYS = ['passwordHash', 'pickupToken', 'tenantId', '__v'];

// Whole-shop export for the owner: no passwords, no secret links, no internal tenant id. Lists longer than the cap are cut and the answer says so.
function shopExport({ tenant, variants, alterations, staff, attendance, expenses, dayCloses, supplierBills, customers, customerInfo, settings, bills }) {
  const clean = (rows) => (rows || []).slice(0, CAP).map((r) => { const o = { ...r }; SECRET_KEYS.forEach((k) => delete o[k]); if (o._id) { o.id = String(o._id); delete o._id; } return o; });
  const lists = { variants, alterations, staff, attendance, expenses, dayCloses, supplierBills, customers, customerInfo, bills };
  const out = { exportedAt: new Date().toISOString(), kind: 'shop_data', shop: tenant ? pick(tenant, ['shopName', 'state', 'currency', 'planKey', 'trialEndsAt', 'paidUntil']) : null, settings: settings ? pick(settings, ['gstBands', 'growthPct', 'discountRule', 'commissionRules', 'leaveAllowance', 'supplierDue']) : null, cut: [] };
  for (const [k, v] of Object.entries(lists)) { out[k] = clean(v); if ((v || []).length > CAP) out.cut.push(k); }
  return out;
}
// What anonymising one customer changes. Returns the updates for each collection (the route applies them, this decides them).
function anonymiseCustomer(now = new Date()) {
  return {
    customer: { $set: { name: 'Removed on request', note: '', isActive: false }, $unset: { phone: '', email: '' } },
    info: { $set: { doNotContact: true, sizes: '' }, $unset: { occasionOn: '' } },
    alteration: { $set: { customerName: 'Removed on request', anonymisedAt: now }, $unset: { customerPhone: '' } },
  };
}
const CONFIRM = 'DELETE';
const confirmOk = (v) => v === CONFIRM;
module.exports = { CAP, shopExport, anonymiseCustomer, confirmOk, CONFIRM, strip };
