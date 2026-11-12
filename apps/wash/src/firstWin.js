'use strict';
// Wash: "first win in five minutes" and the set-up checklist, on the shared core-pos module.
// The one number (the owner's loss): vehicles not washed here for 30 days, and about what their next washes are worth
// (your own average delivered job x vehicles, an estimate that says so). Sample records are named "Sample ..." and kept by id.
const { firstWin: FW } = require('../../../packages/core-pos/src');

const STEPS = [
  { key: 'price_list_set' }, { key: 'attendant_added' }, { key: 'first_job' }, { key: 'day_closed' }, { key: 'suggestion_viewed', manual: true },
];
const QUIET_DAYS = 30;

function makeConfig(M) {
  const ours = (rows, ids, k) => { const skip = new Set((ids[k] || []).map(String)); return rows.filter((r) => !skip.has(String(r._id))); };
  const done = (j) => j.state === 'delivered' && Number.isInteger(j.total) && j.total > 0;
  return {
    product: 'wash', steps: STEPS, sampleDefaults: { count: 18, rupees: 5400 },
    async auto(tid, ids = {}) {
      const [pl, at, jb, dc] = await Promise.all([M.PriceList.findOne({ tenantId: tid }).lean(), M.Attendant.find({ tenantId: tid }).lean(), M.Job.find({ tenantId: tid }).lean(), M.CashClosing.find({ tenantId: tid }).lean()]);
      return { price_list_set: !!(pl && pl.prices && Object.keys(pl.prices).length > 0), attendant_added: at.length > 0, first_job: ours(jb, ids, 'jobs').length > 0, day_closed: dc.length > 0 };
    },
    async metric(tid, ids = {}) {
      const [ve, jb] = await Promise.all([M.Vehicle.find({ tenantId: tid }).lean(), M.Job.find({ tenantId: tid }).lean()]);
      const mine = ours(ve, ids, 'vehicles'); const cut = FW.addDays(FW.istToday(), -QUIET_DAYS);
      const quiet = mine.filter((v) => v.lastWash && v.lastWash < cut && !v.doNotContact);
      const dn = ours(jb, ids, 'jobs').filter(done); const avg = dn.length ? Math.round(dn.reduce((t, j) => t + j.total, 0) / dn.length) : 0;
      return { haveReal: mine.length > 0 || dn.length > 0, count: quiet.length, rupees: quiet.length * avg };
    },
    async hasRealActivity(tid, ids = {}) {
      const [ve, jb] = await Promise.all([M.Vehicle.find({ tenantId: tid }).lean(), M.Job.find({ tenantId: tid }).lean()]);
      return ours(ve, ids, 'vehicles').length > 0 || ours(jb, ids, 'jobs').length > 0;
    },
    async loadSample(tid, ids) {
      const d = FW.istToday(); ids.vehicles = []; ids.jobs = [];
      for (let i = 0; i < 3; i++) { const v = await M.Vehicle.create({ tenantId: tid, plate: 'SAMPLE-' + (i + 1), klass: 'hatchback', ownerName: 'Sample owner', lastWash: FW.addDays(d, -5 - i) }); ids.vehicles.push(String(v._id)); }
      for (let i = 0; i < 3; i++) { const j = await M.Job.create({ tenantId: tid, number: 900 + i, plate: 'SAMPLE-' + (i + 1), klass: 'hatchback', lines: [{ name: 'Sample wash', price: 300 }], subtotal: 300, total: 300, currency: 'INR', state: 'delivered', day: d }); ids.jobs.push(String(j._id)); }
    },
    async removeSample(tid, ids = {}) {
      if ((ids.jobs || []).length) await M.Job.deleteMany({ tenantId: tid, _id: { $in: ids.jobs } });
      if ((ids.vehicles || []).length) await M.Vehicle.deleteMany({ tenantId: tid, _id: { $in: ids.vehicles } });
    },
    async audit(tid, req, action) { await M.Audit.create({ tenantId: tid, action, text: 'owner' }); },
  };
}
module.exports = { STEPS, makeConfig };
