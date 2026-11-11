'use strict';
// Wash Phase 2 routes (13 Nov). Mounted from routes.js, so the same sign-in, role check, read-only guard and tenant filter
// apply. EVERY query filters by tenantId. Written, not yet tested by a person.
const A = require('./accounts'); const PH = require('./photos'); const MONEY = require('./money'); const DR = require('./dataRights'); const VI = require('./vehiclesImport'); const V = require('./vehicles'); const BK = require('./booking'); const PAY = require('./payroll'); const AT = require('./attendance'); const { dayTotals } = require('./incentive');

function mountMore(ctx) {
  const { router, M, wrap, fail, plain, now, dayOf, ownerOnly, range, pnlFor, idOk, priceList } = ctx;

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
  // ---- shifts, pay settings and payslips (owner only for money) ----
  router.post('/shifts', wrap(async (req, res, tid) => {
    const b = req.body || {}; const c = PAY.checkShift(b); if (c.error) return fail(res, 400, c.error);
    if (!idOk(b.attendantId)) return fail(res, 400, 'Choose the attendant');
    const a = await M.Attendant.findOne({ _id: b.attendantId, tenantId: tid, isActive: true }); if (!a) return fail(res, 400, 'Unknown attendant');
    const d = await M.Shift.findOneAndUpdate({ tenantId: tid, attendantId: String(a._id), day: c.value.day }, { $set: { from: c.value.from, to: c.value.to }, $setOnInsert: { tenantId: tid, attendantId: String(a._id), day: c.value.day } }, { upsert: true, new: true });
    res.status(201).json({ success: true, data: { ...plain(d), hours: c.value.hours } });
  }));
  router.get('/shifts', wrap(async (req, res, tid) => {
    const month = /^\d{4}-\d{2}$/.test(req.query.month || '') ? req.query.month : dayOf(now()).slice(0, 7);
    res.json({ success: true, data: { month, rows: (await M.Shift.find({ tenantId: tid, day: { $gte: month + '-01', $lte: month + '-31' } }).sort({ day: 1 }).limit(1000)).map(plain) } });
  }));
  router.put('/attendants/:id/pay', ownerOnly, wrap(async (req, res, tid) => {
    const c = PAY.checkPay(req.body); if (c.error) return fail(res, 400, c.error);
    if (!idOk(req.params.id)) return fail(res, 400, 'Unknown attendant');
    const a = await M.Attendant.findOneAndUpdate({ _id: req.params.id, tenantId: tid }, { $set: c.value }, { new: true }); if (!a) return fail(res, 404, 'Attendant not found');
    await audit(tid, req, 'pay.settings', `salary settings changed for ${a.name}`);
    res.json({ success: true });
  }));
  const slips = async (tid, month, onlyId) => {
    const [people, att, jobs, pl] = await Promise.all([M.Attendant.find({ tenantId: tid, isActive: true }).sort({ name: 1 }).limit(100), M.Attendance.find({ tenantId: tid, day: { $gte: month + '-01', $lte: month + '-31' } }).limit(3000), M.Job.find({ tenantId: tid, day: { $gte: month + '-01', $lte: month + '-31' }, state: 'delivered' }).limit(10000), priceList(tid)]);
    const sum = AT.monthSummary(att.map(plain), month); const inc = dayTotals(jobs.map(plain), pl.incentive);
    return people.map(plain).filter((p) => !onlyId || p.id === onlyId).map((p) => ({ id: p.id, ...PAY.payslip({ month, name: p.name, monthlySalary: p.monthlySalary, paidLeavePerMonth: p.paidLeavePerMonth === undefined ? 1 : p.paidLeavePerMonth, att: sum[p.id] || {}, incentive: (inc[p.id] || {}).incentive || 0, jobs: (inc[p.id] || {}).jobs || 0 }) }));
  };
  router.get('/payslips', ownerOnly, wrap(async (req, res, tid) => {
    const month = /^\d{4}-\d{2}$/.test(req.query.month || '') ? req.query.month : dayOf(now()).slice(0, 7);
    res.set('Cache-Control', 'no-store'); res.json({ success: true, data: { month, slips: await slips(tid, month), note: 'Days with no attendance mark are counted as worked.' } });
  }));
  router.get('/payslips/:id', ownerOnly, wrap(async (req, res, tid) => {
    if (!idOk(req.params.id)) return fail(res, 400, 'Unknown attendant');
    const month = /^\d{4}-\d{2}$/.test(req.query.month || '') ? req.query.month : dayOf(now()).slice(0, 7);
    const one = (await slips(tid, month, req.params.id))[0]; if (!one) return fail(res, 404, 'Attendant not found');
    res.set('Cache-Control', 'no-store'); res.json({ success: true, data: one });
  }));
  // ---- booking link (owner) and the requests that arrive through it ----
  router.get('/booking-link', ownerOnly, wrap(async (req, res, tid) => {
    let t = await M.Tenant.findOne({ _id: tid }); if (!t) return fail(res, 404, 'Business not found');
    let token = t.bookingToken;
    if (!token) { token = BK.newToken(); await M.Tenant.updateOne({ _id: tid }, { $set: { bookingToken: token } }); await audit(tid, req, 'booking.link', 'booking link created'); }
    res.set('Cache-Control', 'no-store');
    res.json({ success: true, data: { path: '/api/wash-book/' + token, note: 'Put your website address in front of this path. For a QR code, paste the full address into any free QR maker.' } });
  }));
  router.post('/booking-link/rotate', ownerOnly, wrap(async (req, res, tid) => {
    const token = BK.newToken(); await M.Tenant.updateOne({ _id: tid }, { $set: { bookingToken: token } });
    await audit(tid, req, 'booking.rotate', 'booking link replaced; the old link stops working');
    res.json({ success: true, data: { path: '/api/wash-book/' + token } });
  }));
  router.get('/bookings', wrap(async (req, res, tid) => {
    const status = ['new', 'accepted', 'declined'].includes(req.query.status) ? req.query.status : 'new';
    res.json({ success: true, data: (await M.Booking.find({ tenantId: tid, status }).sort({ day: 1 }).limit(100)).map(plain) });
  }));
  router.post('/bookings/:id/status', wrap(async (req, res, tid) => {
    const st = (req.body || {}).status; if (!['accepted', 'declined'].includes(st)) return fail(res, 400, 'Choose accepted or declined');
    if (!idOk(req.params.id)) return fail(res, 400, 'Unknown request');
    const d = await M.Booking.findOneAndUpdate({ _id: req.params.id, tenantId: tid }, { $set: { status: st } }, { new: true }); if (!d) return fail(res, 404, 'Request not found');
    res.json({ success: true });
  }));
  // ---- import the old register into Vehicles: preview first, save only when the owner confirms ----
  const existingPlates = async (tid) => new Set((await M.Vehicle.find({ tenantId: tid }).limit(20000)).map((d) => plain(d).plate));
  router.post('/vehicles/import/preview', wrap(async (req, res, tid) => {
    const r = VI.parseVehicles((req.body || {}).csv, await existingPlates(tid)); if (r.error) return fail(res, 400, r.error);
    res.json({ success: true, data: { total: r.total, ok: r.rows.length, willUpdate: r.duplicates, willAdd: r.rows.length - r.duplicates, errors: r.errors.slice(0, 50), errorCount: r.errors.length, sample: r.rows.slice(0, 10), truncated: r.truncated } });
  }));
  router.post('/vehicles/import/commit', ownerOnly, wrap(async (req, res, tid) => {
    const r = VI.parseVehicles((req.body || {}).csv, await existingPlates(tid)); if (r.error) return fail(res, 400, r.error);
    if (r.errors.length && (req.body || {}).skipErrors !== true) return fail(res, 400, r.errors.length + ' rows have problems. Fix them, or confirm to skip those rows.');
    let added = 0; let updated = 0;
    for (const v of r.rows) {
      const set = { klass: v.klass }; if (v.ownerName) set.ownerName = v.ownerName; if (v.ownerPhone) set.ownerPhone = v.ownerPhone;
      await M.Vehicle.findOneAndUpdate({ tenantId: tid, plate: v.plate }, { $set: set, $setOnInsert: { tenantId: tid, plate: v.plate } }, { upsert: true, new: true });
      if (v.exists) updated += 1; else added += 1;
    }
    await audit(tid, req, 'vehicles.import', `${added} added, ${updated} updated, ${r.errors.length} skipped`);
    res.status(201).json({ success: true, data: { added, updated, skipped: r.errors.length } });
  }));
  // ---- export and delete on request (owner only) ----
  router.get('/export', ownerOnly, wrap(async (req, res, tid) => {
    const lim = 20000;
    const [tenant, vehicles, jobs, passes, expenses, closings, attendants, attendance, shifts, refunds, collections, bookings, photos, pl] = await Promise.all([M.Tenant.findOne({ _id: tid }), M.Vehicle.find({ tenantId: tid }).limit(lim), M.Job.find({ tenantId: tid }).limit(lim), M.Pass.find({ tenantId: tid }).limit(lim), M.Expense.find({ tenantId: tid }).limit(lim), M.CashClosing.find({ tenantId: tid }).limit(lim), M.Attendant.find({ tenantId: tid }).limit(lim), M.Attendance.find({ tenantId: tid }).limit(lim), M.Shift.find({ tenantId: tid }).limit(lim), M.Refund.find({ tenantId: tid }).limit(lim), M.Collection.find({ tenantId: tid }).limit(lim), M.Booking.find({ tenantId: tid }).limit(lim), M.Photo.find({ tenantId: tid }).limit(lim), M.PriceList.findOne({ tenantId: tid })]);
    const data = { vehicles, jobs, passes, expenses, cashClosings: closings, attendants, attendance, shifts, refunds, collections, bookings, photos };
    for (const k of Object.keys(data)) data[k] = data[k].map(plain); data.priceList = pl ? plain(pl) : null;
    await audit(tid, req, 'data.export', 'full data export downloaded');
    res.set('Content-Type', 'application/json; charset=utf-8'); res.set('Content-Disposition', `attachment; filename="wash-data-${dayOf(now())}.json"`); res.set('Cache-Control', 'no-store');
    res.send(JSON.stringify(DR.shapeExport({ tenant: tenant && plain(tenant), data, now: now() })));
  }));
  router.post('/vehicles/:plate/anonymise', ownerOnly, wrap(async (req, res, tid) => {
    const plate = V.normalizePlate(req.params.plate); if (!V.validPlate(plate)) return fail(res, 400, 'That number plate does not look right');
    const v = await M.Vehicle.findOne({ tenantId: tid, plate }); if (!v) return fail(res, 404, 'Vehicle not found');
    await M.Vehicle.updateOne({ tenantId: tid, plate }, { $set: { ownerName: '', ownerPhone: undefined, doNotContact: true } });
    for (const b of await M.Booking.find({ tenantId: tid, plate, status: 'new' }).limit(50)) await M.Booking.updateOne({ _id: b._id, tenantId: tid }, { $set: { name: 'Removed on request', phone: '0000000000', note: '' } });
    await audit(tid, req, 'data.anonymise', `owner details removed for ${plate}; money records kept`);
    res.json({ success: true, message: 'Name and phone removed. The bills and money records stay so your accounts still add up.' });
  }));
  router.post('/account/delete-request', ownerOnly, wrap(async (req, res, tid) => {
    const c = DR.checkDeleteRequest(req.body); if (c.error) return fail(res, 400, c.error);
    await M.Tenant.updateOne({ _id: tid }, { $set: { deleteRequestedAt: now(), bookingToken: undefined } });
    await audit(tid, req, 'account.delete_requested', `delete request recorded; booking link switched off; data is removed after ${DR.WAIT_DAYS} days unless cancelled`);
    res.status(202).json({ success: true, message: `Your request is recorded. Export your data now if you need it. It will be removed after ${DR.WAIT_DAYS} days unless you cancel.` });
  }));
  router.post('/account/delete-request/cancel', ownerOnly, wrap(async (req, res, tid) => {
    await M.Tenant.updateOne({ _id: tid }, { $set: { deleteRequestedAt: undefined } });
    await audit(tid, req, 'account.delete_cancelled', 'delete request cancelled');
    res.json({ success: true });
  }));
}
module.exports = mountMore;
