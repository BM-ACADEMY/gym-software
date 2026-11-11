'use strict';
// Wash Phase 2 routes (13 Nov). Mounted from routes.js, so the same sign-in, role check, read-only guard and tenant filter
// apply. EVERY query filters by tenantId. Written, not yet tested by a person.
const A = require('./accounts');

function mountMore(ctx) {
  const { router, M, wrap, fail, plain, now, dayOf, ownerOnly, range, pnlFor } = ctx;

  // ---- owner overview: profit and loss, supplier dues and customer dues in one call (panel "Accounts" screen) ----
  router.get('/accounts/overview', wrap(async (req, res, tid) => {
    const r = range(req.query); if (!r) return fail(res, 400, 'Choose a date range of up to one year');
    const [pnl, unpaid, owed] = await Promise.all([pnlFor(tid, r), M.Expense.find({ tenantId: tid, paid: false }).limit(1000), M.Job.find({ tenantId: tid, due: { $gte: 1 } }).limit(500)]);
    const customerDues = owed.map(plain).map((j) => ({ plate: j.plate, job: j.number, day: j.day, due: j.due, note: j.dueNote || '' })).sort((a, b) => a.day.localeCompare(b.day));
    res.set('Cache-Control', 'no-store');
    res.json({ success: true, data: { pnl, supplierDues: A.supplierDues(unpaid.map(plain)), customerDues, customerDueTotal: customerDues.reduce((s, d) => s + d.due, 0), currency: 'INR' } });
  }));
}
module.exports = mountMore;
