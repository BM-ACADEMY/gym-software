'use strict';
// Salon: "first win in five minutes" and the set-up checklist. Uses the shared module in core-pos.
// The one number: this week's bills and rupees from the owner's OWN records; until then a clearly labelled sample.
// Sample records are Salon customers and bills named "Sample ..."; their ids are kept so removal deletes exactly those.
const { firstWin: FW } = require('../../../packages/core-pos/src');

const STEPS = [
  { key: 'service' }, { key: 'staff' }, { key: 'customer' }, { key: 'bill' },
  { key: 'booking_link', manual: true }, { key: 'discount_rule', manual: true },
];

function makeConfig(M) {
  const ours = (rows, ids, k) => { const skip = new Set((ids[k] || []).map(String)); return rows.filter((r) => !skip.has(String(r._id))); };
  const weekStart = () => FW.addDays(FW.istToday(), -6);
  return {
    product: 'salon', steps: STEPS, sampleDefaults: { count: 12, rupees: 14400 },
    async auto(tid, ids = {}) {
      const [sv, st, cu, bi] = await Promise.all([M.Service.find({ tenantId: tid }).lean(), M.Staff.find({ tenantId: tid }).lean(), M.Customer.find({ tenantId: tid }).lean(), M.Bill.find({ tenantId: tid }).lean()]);
      return { service: sv.length > 0, staff: st.length > 0, customer: ours(cu, ids, 'customers').length > 0, bill: ours(bi, ids, 'bills').length > 0 };
    },
    async metric(tid, ids = {}) {
      const all = ours(await M.Bill.find({ tenantId: tid }).lean(), ids, 'bills');
      const wk = all.filter((b) => b.date >= weekStart() && b.status !== 'void' && b.status !== 'voided');
      const rupees = wk.reduce((t, b) => t + (Number.isInteger(b.subtotal) ? b.subtotal - (b.discount || 0) : 0), 0);
      return { haveReal: all.length > 0, count: wk.length, rupees };
    },
    async hasRealActivity(tid, ids = {}) {
      const [cu, bi] = await Promise.all([M.Customer.find({ tenantId: tid }).lean(), M.Bill.find({ tenantId: tid }).lean()]);
      return ours(cu, ids, 'customers').length > 0 || ours(bi, ids, 'bills').length > 0;
    },
    async loadSample(tid, ids) {
      const today = FW.istToday(); ids.customers = []; ids.bills = [];
      for (const [i, n] of ['Sample Asha', 'Sample Meena', 'Sample Priya'].entries()) {
        const c = await M.Customer.create({ tenantId: tid, name: n, phone: '000000000' + (i + 1), note: 'Sample' }); ids.customers.push(String(c._id));
      }
      for (let i = 0; i < 3; i++) {
        const b = await M.Bill.create({ tenantId: tid, number: 'SAMPLE-' + (i + 1), date: FW.addDays(today, -i), lines: [{ name: 'Sample service', qty: 1, price: 800 }], subtotal: 800, discount: 0, currency: 'INR', status: 'paid' });
        ids.bills.push(String(b._id));
      }
    },
    async removeSample(tid, ids = {}) {
      if ((ids.bills || []).length) await M.Bill.deleteMany({ tenantId: tid, _id: { $in: ids.bills } });
      if ((ids.customers || []).length) await M.Customer.deleteMany({ tenantId: tid, _id: { $in: ids.customers } });
    },
    async audit(tid, req, action) { await M.Audit.create({ tenantId: tid, by: String(req.user && req.user.email || 'owner'), action }); },
  };
}
module.exports = { STEPS, makeConfig };
