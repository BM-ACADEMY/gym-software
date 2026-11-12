'use strict';
// Cloth: "first win in five minutes" and the set-up checklist, on the shared core-pos module.
// The one number (the owner's loss): items sitting in stock with no sale for 90 days, and what they hold (cost price if known,
// otherwise MRP; an estimate that says so). Sample records are named "Sample ..." and kept by id so removal deletes exactly those.
const { firstWin: FW } = require('../../../packages/core-pos/src');

const STEPS = [
  { key: 'variants_added' }, { key: 'first_bill' }, { key: 'staff_added' }, { key: 'day_closed' }, { key: 'suggestion_viewed', manual: true },
];
const SLOW_DAYS = 90;

function makeConfig(M, pos) {
  const ours = (rows, ids, k) => { const skip = new Set((ids[k] || []).map(String)); return rows.filter((r) => !skip.has(String(r._id))); };
  return {
    product: 'cloth', steps: STEPS, sampleDefaults: { count: 14, rupees: 38000 },
    async auto(tid, ids = {}) {
      const [va, bi, st, dc] = await Promise.all([M.Variant.find({ tenantId: tid }).lean(), pos.PosBill.find({ tenantId: tid }).lean(), M.Staff.find({ tenantId: tid }).lean(), M.DayClose.find({ tenantId: tid }).lean()]);
      return { variants_added: ours(va, ids, 'variants').length > 0, first_bill: ours(bi, ids, 'bills').length > 0, staff_added: st.length > 0, day_closed: dc.length > 0 };
    },
    async metric(tid, ids = {}) {
      const va = ours(await M.Variant.find({ tenantId: tid }).lean(), ids, 'variants').filter((v) => v.isActive !== false); const cut = FW.addDays(FW.istToday(), -SLOW_DAYS);
      const slow = va.filter((v) => v.qty > 0 && (v.lastSoldOn || v.addedOn || '9999-12-31') < cut);
      const value = (v) => (Number.isInteger(v.cost) && v.cost > 0 ? v.cost : v.mrp || 0) * Math.max(0, Math.floor(v.qty));
      return { haveReal: va.length > 0, count: slow.length, rupees: slow.reduce((t, v) => t + value(v), 0) };
    },
    async hasRealActivity(tid, ids = {}) {
      const [va, bi] = await Promise.all([M.Variant.find({ tenantId: tid }).lean(), pos.PosBill.find({ tenantId: tid }).lean()]);
      return ours(va, ids, 'variants').length > 0 || ours(bi, ids, 'bills').length > 0;
    },
    async loadSample(tid, ids) {
      ids.variants = []; ids.bills = [];
      for (const [i, [style, price]] of [['Sample kurta', 799], ['Sample shirt', 999], ['Sample saree', 1499]].entries()) {
        const v = await M.Variant.create({ tenantId: tid, style, size: 'M', colour: 'Blue', key: 'SAMPLE-' + (i + 1), mrp: price, currency: 'INR', qty: 5 }); ids.variants.push(String(v._id));
      }
      for (let i = 0; i < 3; i++) { const b = await pos.PosBill.create({ tenantId: tid, number: 'SAMPLE-' + (i + 1), lines: [{ name: 'Sample kurta', qty: 1, price: 799 }], subtotal: 799, discount: 0, total: 799, currency: 'INR', status: 'paid' }); ids.bills.push(String(b._id)); }
    },
    async removeSample(tid, ids = {}) {
      if ((ids.bills || []).length) await pos.PosBill.deleteMany({ tenantId: tid, _id: { $in: ids.bills } });
      if ((ids.variants || []).length) await M.Variant.deleteMany({ tenantId: tid, _id: { $in: ids.variants } });
    },
    async audit(tid, req, action) { await M.Audit.create({ tenantId: tid, action, text: 'owner' }); },
  };
}
module.exports = { STEPS, makeConfig };
