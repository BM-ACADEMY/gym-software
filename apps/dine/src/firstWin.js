'use strict';
// Dine: "first win in five minutes" and the set-up checklist, on the shared core-pos module.
// The one number (the owner's loss): guests who have not been back in 60 days, and about what their visits are worth
// (your own average paid bill x guests, an estimate that says so). Sample records are named "Sample ..." and kept by id.
const { firstWin: FW } = require('../../../packages/core-pos/src');

const STEPS = [
  { key: 'menu_added' }, { key: 'first_order_paid' }, { key: 'day_closed' }, { key: 'staff_added' },
  { key: 'qr_menu_shared', manual: true }, { key: 'suggestion_viewed', manual: true },
];
const QUIET_DAYS = 60;

function makeConfig(M) {
  const ours = (rows, ids, k) => { const skip = new Set((ids[k] || []).map(String)); return rows.filter((r) => !skip.has(String(r._id))); };
  const paid = (o) => o.status === 'paid' && Number.isInteger(o.grandTotal) && o.grandTotal > 0;
  return {
    product: 'dine', steps: STEPS, sampleDefaults: { count: 9, rupees: 5400 },
    async auto(tid, ids = {}) {
      const [mi, od, dc, us] = await Promise.all([M.MenuItem.find({ tenantId: tid }).lean(), M.Order.find({ tenantId: tid }).lean(), M.DayClose.find({ tenantId: tid }).lean(), M.User.find({ tenantId: tid }).lean()]);
      return { menu_added: ours(mi, ids, 'items').length > 0, first_order_paid: ours(od, ids, 'orders').some(paid), day_closed: dc.length > 0, staff_added: us.length > 1 };
    },
    async metric(tid, ids = {}) {
      const [cu, od] = await Promise.all([M.Customer.find({ tenantId: tid }).lean(), M.Order.find({ tenantId: tid }).lean()]);
      const mine = ours(cu, ids, 'customers'); const cut = FW.addDays(FW.istToday(), -QUIET_DAYS);
      const quiet = mine.filter((c) => !c.anonymised && !c.doNotContact && (c.visits || []).length > 0 && [...c.visits].sort().pop() < cut);
      const pd = ours(od, ids, 'orders').filter(paid); const avg = pd.length ? Math.round(pd.reduce((t, o) => t + o.grandTotal, 0) / pd.length) : 0;
      return { haveReal: mine.length > 0 || pd.length > 0, count: quiet.length, rupees: quiet.length * avg };
    },
    async hasRealActivity(tid, ids = {}) {
      const [cu, od, mi] = await Promise.all([M.Customer.find({ tenantId: tid }).lean(), M.Order.find({ tenantId: tid }).lean(), M.MenuItem.find({ tenantId: tid }).lean()]);
      return ours(cu, ids, 'customers').length > 0 || ours(od, ids, 'orders').length > 0 || ours(mi, ids, 'items').length > 0;
    },
    async loadSample(tid, ids) {
      const d = FW.istToday(); ids.items = []; ids.customers = []; ids.orders = [];
      for (const [i, [n, price]] of [['Sample dosa', 80], ['Sample filter coffee', 30], ['Sample meals', 150]].entries()) { const x = await M.MenuItem.create({ tenantId: tid, key: 'sample-' + (i + 1), name: n, price, currency: 'INR' }); ids.items.push(String(x._id)); }
      for (const [i, n] of ['Sample Guest 1', 'Sample Guest 2'].entries()) { const c = await M.Customer.create({ tenantId: tid, name: n, phone: '000000000' + (i + 1), visits: [FW.addDays(d, -3)] }); ids.customers.push(String(c._id)); }
      for (let i = 0; i < 3; i++) { const o = await M.Order.create({ tenantId: tid, number: 'SAMPLE-' + (i + 1), status: 'paid', lines: [{ name: 'Sample meals', qty: 1, price: 150 }], grandTotal: 150, currency: 'INR', paidAt: new Date() }); ids.orders.push(String(o._id)); }
    },
    async removeSample(tid, ids = {}) {
      if ((ids.orders || []).length) await M.Order.deleteMany({ tenantId: tid, _id: { $in: ids.orders } });
      if ((ids.customers || []).length) await M.Customer.deleteMany({ tenantId: tid, _id: { $in: ids.customers } });
      if ((ids.items || []).length) await M.MenuItem.deleteMany({ tenantId: tid, _id: { $in: ids.items } });
    },
    async audit(tid, req, action) { if (M.Activity) await M.Activity.create({ tenantId: tid, by: String(req.user && req.user.email || 'owner'), action, ref: 'setup' }); },
  };
}
module.exports = { STEPS, makeConfig };
