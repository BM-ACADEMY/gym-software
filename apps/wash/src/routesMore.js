'use strict';
// Wash Phase 2 routes (13 Nov). Mounted from routes.js, so the same sign-in, role check, read-only guard and tenant filter
// apply. EVERY query filters by tenantId. Written, not yet tested by a person.
const A = require('./accounts'); const PH = require('./photos'); const MONEY = require('./money');

function mountMore(ctx) {
  const { router, M, wrap, fail, plain, now, dayOf, ownerOnly, range, pnlFor, idOk } = ctx;

  // ---- owner overview: profit and loss, supplier dues and customer dues in one call (panel "Accounts" screen) ----
  router.get('/accounts/overview', wrap(async (req, res, tid) => {
    const r = range(req.query); if (!r) return fail(res, 400, 'Choose a date range of up to one year');
    const [pnl, unpaid, owed] = await Promise.all([pnlFor(tid, r), M.Expense.find({ tenantId: tid, paid: false }).limit(1000), M.Job.find({ tenantId: tid, due: { $gte: 1 } }).limit(500)]);
    const customerDues = owed.map(plain).map((j) => ({ plate: j.plate, job: j.number, day: j.day, due: j.due, note: j.dueNote || '' })).sort((a, b) => a.day.localeCompare(b.day));
    res.set('Cache-Control', 'no-store');
    res.json({ success: true, data: { pnl, supplierDues: A.supplierDues(unpaid.map(plain)), customerDues, customerDueTotal: customerDues.reduce((s, d) => s + d.due, 0), currency: 'INR' } });
  }));
  const audit = (tid, req, action, text) => M.Audit.create({ tenantId: tid, action, text: String(text).slice(0, 240), by: req.user && req.user.id });
  const jobOf = async (req, tid) => (idOk(req.params.id) ? M.Job.findOne({ _id: req.params.id, tenantId: tid }) : null);

  // ---- before and after photos: a storage reference only (the picture is uploaded to cloud storage by the app) ----
  router.post('/jobs/:id/photos', wrap(async (req, res, tid) => {
    const job = await jobOf(req, tid); if (!job) return fail(res, 404, 'Job not found');
    const c = PH.checkPhoto(req.body); if (c.error) return fail(res, 400, c.error);
    const n = await M.Photo.countDocuments({ tenantId: tid, jobId: String(job._id), kind: c.value.kind });
    if (n >= PH.MAX_PER_KIND) return fail(res, 409, 'That is enough ' + c.value.kind + ' photos for one job');
    const d = await M.Photo.create({ tenantId: tid, jobId: String(job._id), ...c.value, by: req.user && req.user.id });
    await M.UsageLog.create({ tenantId: tid, kind: 'photo' });
    res.status(201).json({ success: true, data: plain(d) });
  }));
  router.get('/jobs/:id/photos', wrap(async (req, res, tid) => {
    const job = await jobOf(req, tid); if (!job) return fail(res, 404, 'Job not found');
    res.json({ success: true, data: (await M.Photo.find({ tenantId: tid, jobId: String(job._id) }).sort({ createdAt: 1 }).limit(20)).map(plain) });
  }));

  // ---- customer dues: delivered with something still to pay (set at delivery with payLater), collected later ----
  router.get('/dues/customers', wrap(async (req, res, tid) => {
    const jobs = (await M.Job.find({ tenantId: tid, due: { $gte: 1 } }).sort({ day: 1 }).limit(500)).map(plain);
    const vehicles = {}; for (const v of (await M.Vehicle.find({ tenantId: tid }).limit(3000)).map(plain)) vehicles[v.plate] = v;
    const rows = jobs.map((j) => ({ id: j.id, plate: j.plate, number: j.number, day: j.day, due: j.due, note: j.dueNote || '', ownerName: (vehicles[j.plate] || {}).ownerName || '', ownerPhone: (vehicles[j.plate] || {}).doNotContact ? '' : (vehicles[j.plate] || {}).ownerPhone || '' }));
    res.json({ success: true, data: { rows, total: rows.reduce((a, r) => a + r.due, 0), currency: 'INR' } });
  }));
  router.post('/jobs/:id/collect', wrap(async (req, res, tid) => {
    const job = await jobOf(req, tid); if (!job) return fail(res, 404, 'Job not found');
    const j = plain(job); const c = MONEY.checkCollection({ due: j.due, pays: (req.body || {}).payments });
    if (c.error) return fail(res, 400, c.error);
    const day = dayOf(now());
    for (const p of req.body.payments) await M.Collection.create({ tenantId: tid, jobId: String(job._id), plate: j.plate, day, amount: p.amount, method: p.method, by: req.user && req.user.id });
    await M.Job.updateOne({ _id: req.params.id, tenantId: tid }, { $set: { due: c.left, collected: (j.collected || 0) + c.collected } });
    await audit(tid, req, 'job.collect', `job ${j.number}: Rs ${c.collected} collected, Rs ${c.left} still due`);
    res.json({ success: true, data: { collected: c.collected, due: c.left } });
  }));

  // ---- refunds (owner only: money going out). A reason is always required; it counts in the cash book, closing and P&L ----
  router.post('/jobs/:id/refund', ownerOnly, wrap(async (req, res, tid) => {
    const job = await jobOf(req, tid); if (!job) return fail(res, 404, 'Job not found');
    const j = plain(job); const b = req.body || {};
    const c = MONEY.checkRefund({ job: j, amount: b.amount, method: b.method, reason: b.reason }); if (c.error) return fail(res, 400, c.error);
    await M.Refund.create({ tenantId: tid, jobId: String(job._id), plate: j.plate, day: dayOf(now()), ...c.value, by: req.user && req.user.id });
    await M.Job.updateOne({ _id: req.params.id, tenantId: tid }, { $set: { refunded: (j.refunded || 0) + c.value.amount } });
    await audit(tid, req, 'job.refund', `job ${j.number}: Rs ${c.value.amount} by ${c.value.method}: ${c.value.reason}`);
    res.status(201).json({ success: true, data: { refunded: (j.refunded || 0) + c.value.amount, currency: 'INR' } });
  }));
  router.get('/refunds', ownerOnly, wrap(async (req, res, tid) => res.json({ success: true, data: (await M.Refund.find({ tenantId: tid }).sort({ createdAt: -1 }).limit(100)).map(plain) })));
}
module.exports = mountMore;
