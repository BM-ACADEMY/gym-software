'use strict';
// Salon: "first win in five minutes" and the set-up checklist. Uses the shared module in core-pos.
// The one number (the owner's loss): customers who have not been back in 60 days and about how many rupees they are worth,
// worked out from the owner's OWN records; until they have any, a clearly labelled sample.
// Sample records are Salon customers and bills named "Sample ..."; their ids are kept so removal deletes exactly those.
const { firstWin: FW } = require('../../../packages/core-pos/src');

const STEPS = [
  { key: 'prices_set' }, { key: 'staff_ready' }, { key: 'first_bill' },
  { key: 'suggestion_viewed', manual: true }, { key: 'booking_link_shared', manual: true },
];
const QUIET_DAYS = 60;

function makeConfig(M) {
  const ours = (rows, ids, k) => { const skip = new Set((ids[k] || []).map(String)); return rows.filter((r) => !skip.has(String(r._id))); };
  return {
    product: 'salon', steps: STEPS, sampleDefaults: { count: 12, rupees: 14400 },
    async auto(tid, ids = {}) {
      const [sv, st, bi] = await Promise.all([M.Service.find({ tenantId: tid }).lean(), M.Staff.find({ tenantId: tid }).lean(), M.Bill.find({ tenantId: tid }).lean()]);
      return { prices_set: sv.some((x) => x.price > 0), staff_ready: st.length > 0, first_bill: ours(bi, ids, 'bills').length > 0 };
    },
    async metric(tid, ids = {}) {
      const [cu, sv] = await Promise.all([M.Customer.find({ tenantId: tid }).lean(), M.Service.find({ tenantId: tid }).lean()]);
      const mine = ours(cu, ids, 'customers'); const price = Object.fromEntries(sv.map((x) => [x.key, x.price || 0])); const cut = FW.addDays(FW.istToday(), -QUIET_DAYS);
      const quiet = mine.filter((c) => c.lastVisit && c.lastVisit < cut && !c.doNotContact && !c.anonymisedAt);
      return { haveReal: mine.length > 0, count: quiet.length, rupees: quiet.reduce((t, c) => t + (price[c.lastServiceKey] || 0), 0) };
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
