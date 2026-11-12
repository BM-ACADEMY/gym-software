'use strict';
// Mart: "first win in five minutes" and the set-up checklist, on the shared core-pos module.
// The one number (the owner's loss): udhaar (pay-later) still pending and how many customers owe it, from the shop's OWN records.
// Sample records are named "Sample ..." and kept by id so removal deletes exactly those.
const { firstWin: FW } = require('../../../packages/core-pos/src');

const STEPS = [
  { key: 'items_added' }, { key: 'first_bill' }, { key: 'staff_added' }, { key: 'day_closed' }, { key: 'suggestion_viewed', manual: true },
];

function makeConfig(M, P) {
  const ours = (rows, ids, k) => { const skip = new Set((ids[k] || []).map(String)); return rows.filter((r) => !skip.has(String(r._id))); };
  return {
    product: 'mart', steps: STEPS, sampleDefaults: { count: 5, rupees: 6200 },
    async auto(tid, ids = {}) {
      const [it, bi, st, dc] = await Promise.all([P.PosItem.find({ tenantId: tid }).lean(), P.PosBill.find({ tenantId: tid }).lean(), M.Staff.find({ tenantId: tid }).lean(), M.DayClose.find({ tenantId: tid }).lean()]);
      return { items_added: ours(it, ids, 'items').length > 0, first_bill: ours(bi, ids, 'bills').length > 0, staff_added: st.length > 0, day_closed: dc.length > 0 };
    },
    async metric(tid, ids = {}) {
      const [cu, bi] = await Promise.all([P.PosCustomer.find({ tenantId: tid }).lean(), P.PosBill.find({ tenantId: tid }).lean()]);
      const mine = ours(cu, ids, 'customers'); const owing = mine.filter((c) => c.isActive !== false && Number.isInteger(c.creditDue) && c.creditDue > 0);
      return { haveReal: mine.length > 0 || ours(bi, ids, 'bills').length > 0, count: owing.length, rupees: owing.reduce((t, c) => t + c.creditDue, 0) };
    },
    async hasRealActivity(tid, ids = {}) {
      const [cu, bi, it] = await Promise.all([P.PosCustomer.find({ tenantId: tid }).lean(), P.PosBill.find({ tenantId: tid }).lean(), P.PosItem.find({ tenantId: tid }).lean()]);
      return ours(cu, ids, 'customers').length > 0 || ours(bi, ids, 'bills').length > 0 || ours(it, ids, 'items').length > 0;
    },
    async loadSample(tid, ids) {
      ids.items = []; ids.customers = []; ids.bills = [];
      for (const [n, price] of [['Sample rice 1 kg', 60], ['Sample dal 1 kg', 120], ['Sample soap', 40]]) { const i = await P.PosItem.create({ tenantId: tid, name: n, price, currency: 'INR' }); ids.items.push(String(i._id)); }
      for (const [i, n] of ['Sample Kumar', 'Sample Lakshmi'].entries()) { const c = await P.PosCustomer.create({ tenantId: tid, name: n, phone: '000000000' + (i + 1), note: 'Sample' }); ids.customers.push(String(c._id)); }
      for (let i = 0; i < 3; i++) { const b = await P.PosBill.create({ tenantId: tid, number: 'SAMPLE-' + (i + 1), lines: [{ name: 'Sample rice 1 kg', qty: 2, price: 60 }], subtotal: 120, discount: 0, total: 120, currency: 'INR', status: 'paid' }); ids.bills.push(String(b._id)); }
    },
    async removeSample(tid, ids = {}) {
      if ((ids.bills || []).length) await P.PosBill.deleteMany({ tenantId: tid, _id: { $in: ids.bills } });
      if ((ids.customers || []).length) await P.PosCustomer.deleteMany({ tenantId: tid, _id: { $in: ids.customers } });
      if ((ids.items || []).length) await P.PosItem.deleteMany({ tenantId: tid, _id: { $in: ids.items } });
    },
    async audit(tid, req, action) { await M.Audit.create({ tenantId: tid, by: String(req.user && req.user.email || 'owner'), role: 'admin', action }); },
  };
}
module.exports = { STEPS, makeConfig };
