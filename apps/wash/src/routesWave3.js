'use strict';
// Wash WSH-10 routes (13 Nov): booking QR and booking-to-job, pay advances and deductions, refunds by plate, dues list, one-box register
// import, photo upload to local disk, job card page, bay. Mounted from routes.js after routesMore.js, so the same sign-in, role check,
// read-only guard and tenant filter apply. EVERY query filters by tenantId. Written, not yet tested by a person.
const QR = require('./qr'); const BK = require('./booking'); const V = require('./vehicles'); const P = require('./pass'); const J = require('./jobs');
const PAY = require('./payroll'); const PH = require('./photos'); const ST = require('./storage'); const MONEY = require('./money'); const VI = require('./vehiclesImport');
const BAYS = require('./bays'); const { jobCardHtml } = require('./jobCard');
const LOCK = "default-src 'none'; style-src 'unsafe-inline'";

function mountWave3(ctx) {
  const { router, M, wrap, fail, plain, now, dayOf, idOk, ownerOnly, priceList, express, photoStore } = ctx;
  const audit = ctx.audit || ((tid, req, action, text) => M.Audit.create({ tenantId: tid, action, text: String(text).slice(0, 240), by: req.user && req.user.id }));
  const jobOf = async (req, tid) => (idOk(req.params.id) ? M.Job.findOne({ _id: req.params.id, tenantId: tid }) : null);
  const page = (res, html) => { res.set('Content-Type', 'text/html; charset=utf-8'); res.set('Cache-Control', 'no-store'); res.set('Content-Security-Policy', LOCK); res.set('X-Content-Type-Options', 'nosniff'); res.send(html); };
  // An attendant by id (apps) or typed name (the panel form has no id picker). Two with the same name: refuse, never guess.
  const attendantOf = async (tid, b) => {
    if (b.attendantId !== undefined && b.attendantId !== '') return idOk(b.attendantId) ? { a: await M.Attendant.findOne({ _id: b.attendantId, tenantId: tid, isActive: true }) } : { error: 'Choose the attendant' };
    if (typeof b.attendant !== 'string' || !b.attendant.trim()) return { error: 'Choose the attendant' };
    const hits = await M.Attendant.find({ tenantId: tid, name: b.attendant.trim(), isActive: true }).limit(2);
    return hits.length > 1 ? { error: 'Two attendants have that name. Rename one so they differ.', code: 409 } : { a: hits[0] || null };
  };

  // ---- QR picture of the booking link (owner). The address is WASH_PUBLIC_URL if set, else the address the owner is using now ----
  const baseUrl = (req) => {
    const env = process.env.WASH_PUBLIC_URL; if (env && /^https:\/\/[a-z0-9.-]+(:\d+)?$/i.test(env)) return env;
    const host = String((req.headers && req.headers.host) || ''); return /^[a-z0-9.-]+(:\d+)?$/i.test(host) ? 'https://' + host : null;
  };
  router.get('/booking-link/qr.svg', ownerOnly, wrap(async (req, res, tid) => {
    const t = await M.Tenant.findOne({ _id: tid }); if (!t) return fail(res, 404, 'Business not found');
    let token = t.bookingToken; if (!token) { token = BK.newToken(); await M.Tenant.updateOne({ _id: tid }, { $set: { bookingToken: token } }); await audit(tid, req, 'booking.link', 'booking link created'); }
    const base = baseUrl(req); if (!base) return fail(res, 400, 'Cannot work out the website address. Ask Afra to set WASH_PUBLIC_URL.');
    const svg = QR.qrSvg(base + '/api/wash-book/' + token, { ecl: 'M', scale: 6 });
    res.set('Content-Type', 'image/svg+xml; charset=utf-8'); res.set('Cache-Control', 'no-store'); res.set('Content-Security-Policy', LOCK); res.send(svg);
  }));

  // ---- a booking request becomes a job (owner). The customer's phone is NOT copied to the vehicle: they agreed to be answered, not to be marketed to ----
  router.post('/bookings/:id/convert', ownerOnly, wrap(async (req, res, tid) => {
    if (!idOk(req.params.id)) return fail(res, 400, 'Unknown request');
    const bk = plain(await M.Booking.findOne({ _id: req.params.id, tenantId: tid })); if (!bk || !bk._id) return fail(res, 404, 'Request not found');
    if (!['new', 'accepted'].includes(bk.status)) return fail(res, 409, bk.status === 'converted' ? 'This request is already a job.' : 'This request was declined.');
    const b = req.body || {}; const plate = V.normalizePlate(b.plate || bk.plate || ''); if (!V.validPlate(plate)) return fail(res, 400, 'Type the number plate of the vehicle');
    const veh = await M.Vehicle.findOne({ tenantId: tid, plate }); const klass = b.klass || bk.klass || (veh && veh.klass);
    const pl = await priceList(tid); const q = V.quote(pl.prices, pl.addons, klass, Array.isArray(b.addons) ? b.addons.slice(0, 10) : []); if (q.error) return fail(res, 400, q.error);
    const bayC = BAYS.checkBay(b.bay); if (bayC.error) return fail(res, 400, bayC.error);
    // Claim the request first so two taps never make two jobs.
    const claimed = await M.Booking.findOneAndUpdate({ _id: req.params.id, tenantId: tid, status: { $in: ['new', 'accepted'] } }, { $set: { status: 'converted' } }, { new: true });
    if (!claimed) return fail(res, 409, 'This request is already handled.');
    try {
      if (!veh) await M.Vehicle.findOneAndUpdate({ tenantId: tid, plate }, { $set: { klass }, $setOnInsert: { tenantId: tid, plate } }, { upsert: true, new: true });
      const today = dayOf(now()); const passes = await M.Pass.find({ tenantId: tid, plate, endsOn: { $gte: today } }).sort({ endsOn: 1 });
      const pass = passes.map(plain).find((p) => P.status(p, today).usable); const count = await M.Job.countDocuments({ tenantId: tid, day: today });
      const base = J.newJob({ plate, klass, services: q.lines, now: now() });
      const job = await M.Job.create({ tenantId: tid, number: count + 1, plate, klass, lines: q.lines, subtotal: q.total, total: q.total, discount: 0, currency: 'INR', state: base.state, bay: bayC.value, passId: pass ? pass.id : undefined, passCovered: pass ? q.lines[0].amount : 0, day: today });
      await M.Booking.updateOne({ _id: req.params.id, tenantId: tid }, { $set: { jobId: job._id } });
      await audit(tid, req, 'booking.convert', `request for ${bk.day} ${bk.slot} became job ${job.number} (${plate})`);
      res.status(201).json({ success: true, data: { jobId: String(job._id), number: job.number, passFound: !!pass } });
    } catch (e) { await M.Booking.updateOne({ _id: req.params.id, tenantId: tid }, { $set: { status: bk.status } }); throw e; }
  }));

  // ---- pay advances and deductions (owner only). They come off the payslip total (routesMore.js reads them) ----
  router.post('/pay-adjustments', ownerOnly, wrap(async (req, res, tid) => {
    const b = req.body || {}; const c = PAY.checkAdjust(b); if (c.error) return fail(res, 400, c.error);
    const r = await attendantOf(tid, b); if (r.error) return fail(res, r.code || 400, r.error); if (!r.a) return fail(res, 404, 'Attendant not found. Type the name exactly as in your list.');
    const day = c.value.day || dayOf(now()); if (day > dayOf(new Date(now().getTime() + 86400000))) return fail(res, 400, 'Choose a date that is not in the future');
    const d = await M.PayAdjust.create({ tenantId: tid, attendantId: String(r.a._id), kind: c.value.kind, amount: c.value.amount, day, note: c.value.note || undefined, by: req.user && req.user.id });
    await audit(tid, req, 'pay.' + c.value.kind, `${r.a.name}: Rs ${c.value.amount}${c.value.note ? ' (' + c.value.note + ')' : ''}`);
    res.status(201).json({ success: true, data: { id: String(d._id), currency: 'INR' } });
  }));
  router.get('/pay-adjustments', ownerOnly, wrap(async (req, res, tid) => {
    const month = /^\d{4}-\d{2}$/.test(req.query.month || '') ? req.query.month : dayOf(now()).slice(0, 7);
    const [rows, people] = await Promise.all([M.PayAdjust.find({ tenantId: tid, day: { $gte: month + '-01', $lte: month + '-31' } }).sort({ day: -1 }).limit(500), M.Attendant.find({ tenantId: tid }).limit(200)]);
    const nm = {}; for (const x of people.map(plain)) nm[String(x._id)] = x.name;
    res.set('Cache-Control', 'no-store'); res.json({ success: true, data: rows.map(plain).map((x) => ({ id: x.id, day: x.day, attendant: nm[String(x.attendantId)] || '', kind: x.kind, amount: x.amount, note: x.note || '', currency: x.currency || 'INR' })) });
  }));

  // ---- refund by number plate (the panel form has no job picker): the latest delivered job of that plate, or the one on the given day ----
  router.post('/refunds', ownerOnly, wrap(async (req, res, tid) => {
    const b = req.body || {}; const plate = V.normalizePlate(b.plate); if (!V.validPlate(plate)) return fail(res, 400, 'That number plate does not look right');
    if (b.day !== undefined && b.day !== '' && !ctx.DAYRE.test(b.day)) return fail(res, 400, 'Choose a real date');
    const q = { tenantId: tid, plate, state: 'delivered' }; if (b.day) q.day = b.day;
    const job = (await M.Job.find(q).sort({ day: -1 }).limit(1)).map(plain)[0]; if (!job) return fail(res, 404, 'No delivered job found for that vehicle' + (b.day ? ' on that day' : ''));
    const c = MONEY.checkRefund({ job, amount: b.amount, method: b.method, reason: b.reason }); if (c.error) return fail(res, 400, c.error);
    await M.Refund.create({ tenantId: tid, jobId: String(job._id), plate: job.plate, day: dayOf(now()), ...c.value, by: req.user && req.user.id });
    await M.Job.updateOne({ _id: job._id, tenantId: tid }, { $set: { refunded: (job.refunded || 0) + c.value.amount } });
    await audit(tid, req, 'job.refund', `job ${job.number} (${job.day}): Rs ${c.value.amount} by ${c.value.method}: ${c.value.reason}`);
    res.status(201).json({ success: true, data: { refunded: (job.refunded || 0) + c.value.amount, currency: 'INR' }, message: `Refunded Rs ${c.value.amount} on job ${job.number} of ${job.day}.` });
  }));

  // ---- customer dues as a plain list for the panel (the older /dues/customers has totals around the rows) ----
  router.get('/dues', wrap(async (req, res, tid) => {
    const jobs = (await M.Job.find({ tenantId: tid, due: { $gte: 1 } }).sort({ day: 1 }).limit(500)).map(plain);
    const vehicles = {}; for (const v of (await M.Vehicle.find({ tenantId: tid }).limit(3000)).map(plain)) vehicles[v.plate] = v;
    res.set('Cache-Control', 'no-store'); res.json({ success: true, data: jobs.map((j) => ({ id: j.id, plate: j.plate, number: j.number, day: j.day, due: j.due, note: j.dueNote || '', ownerName: (vehicles[j.plate] || {}).ownerName || '', currency: 'INR' })) });
  }));

  // ---- register import in one box: "check" shows what would happen, "save" does it (owner) ----
  router.get('/vehicles/import', ownerOnly, wrap(async (req, res, tid) => {
    const rows = await M.Audit.find({ tenantId: tid, action: 'vehicles.import' }).sort({ createdAt: -1 }).limit(20);
    res.json({ success: true, data: rows.map(plain).map((x) => ({ id: x.id, at: x.createdAt, text: x.text })) });
  }));
  router.post('/vehicles/import', ownerOnly, wrap(async (req, res, tid) => {
    const b = req.body || {}; if (!['check', 'save'].includes(b.mode)) return fail(res, 400, 'Choose "Check first" or "Save"');
    const have = new Set((await M.Vehicle.find({ tenantId: tid }).limit(20000)).map((d) => plain(d).plate));
    const r = VI.parseVehicles(b.csv, have); if (r.error) return fail(res, 400, r.error);
    if (b.mode === 'check') {
      const bad = r.errors.slice(0, 3).map((e) => `line ${e.line}: ${e.message}`).join('; ');
      return res.json({ success: true, message: `Checked ${r.total} rows: ${r.rows.length} fine (${r.rows.length - r.duplicates} new, ${r.duplicates} will update), ${r.errors.length} with problems${bad ? ' (' + bad + (r.errors.length > 3 ? '; more' : '') + ')' : ''}. Nothing was saved. Choose Save to add the fine rows.` });
    }
    if (r.errors.length && b.skipErrors !== true) return fail(res, 400, `${r.errors.length} rows have problems. Fix them, or tick "skip the rows with problems".`);
    const out = await ctx.commitVehicles(tid, req, r);
    res.status(201).json({ success: true, data: out, message: `Saved: ${out.added} added, ${out.updated} updated, ${out.skipped} skipped.` });
  }));

  // ---- photos: upload to the server's own folder (WASH_PHOTO_DIR). A cloud account is the owner's decision (WSH-P1) ----
  const store = photoStore !== undefined ? photoStore : ST.fromEnv();
  const rawBody = express && typeof express.raw === 'function' ? [express.raw({ type: PH.MIME, limit: PH.MAX_BYTES })] : [];
  router.post('/jobs/:id/photos/upload', ...rawBody, wrap(async (req, res, tid) => {
    if (!store) return fail(res, 503, 'Photo storage is not set up yet. Ask your Afra contact.');
    const job = await jobOf(req, tid); if (!job) return fail(res, 404, 'Job not found');
    const kind = req.query && req.query.kind; if (!PH.KINDS.includes(kind)) return fail(res, 400, 'Choose before or after');
    const buf = req.body; if (!Buffer.isBuffer(buf) || !buf.length) return fail(res, 400, 'Send the photo as the request body (JPEG, WebP or PNG)');
    if (buf.length > PH.MAX_BYTES) return fail(res, 413, 'This photo is too big. Compress it to about 300 KB before uploading.');
    const claimed = String((req.headers && req.headers['content-type']) || '').split(';')[0].trim().toLowerCase(); const real = ST.sniff(buf);
    if (!real || real !== claimed || !PH.MIME.includes(real)) return fail(res, 400, 'Photos can be JPEG, WebP or PNG');
    if ((await M.Photo.countDocuments({ tenantId: tid, jobId: String(job._id), kind })) >= PH.MAX_PER_KIND) return fail(res, 409, 'That is enough ' + kind + ' photos for one job');
    const key = ST.newKey(tid, String(job._id), real); await store.put(key, buf);
    let d; try { d = await M.Photo.create({ tenantId: tid, jobId: String(job._id), kind, ref: key, bytes: buf.length, mime: real, store: 'local', by: req.user && req.user.id }); }
    catch (e) { await store.remove(key); throw e; }
    await M.UsageLog.create({ tenantId: tid, kind: 'photo' });
    res.status(201).json({ success: true, data: { id: String(d._id), kind, bytes: buf.length, url: '/api/wash/photos/' + String(d._id) + '/file' } });
  }));
  router.get('/photos/:id/file', wrap(async (req, res, tid) => {
    if (!store) return fail(res, 503, 'Photo storage is not set up yet.');
    const d = idOk(req.params.id) ? plain(await M.Photo.findOne({ _id: req.params.id, tenantId: tid })) : null;
    // Only files this feature stored for THIS business: a reference typed into the older reference-only route can never read a file.
    if (!d || !d._id || d.store !== 'local' || !String(d.ref).startsWith(tid + '/')) return fail(res, 404, 'Photo not found');
    const buf = await store.get(d.ref); if (!buf) return fail(res, 404, 'Photo not found');
    res.set('Content-Type', d.mime); res.set('Cache-Control', 'private, no-store'); res.set('X-Content-Type-Options', 'nosniff'); res.set('Content-Security-Policy', "default-src 'none'; sandbox"); res.send(buf);
  }));
  router.get('/photos', wrap(async (req, res, tid) => {
    const photos = (await M.Photo.find({ tenantId: tid }).sort({ createdAt: -1 }).limit(50)).map(plain); const ids = [...new Set(photos.map((x) => String(x.jobId)))];
    const jobs = ids.length ? (await M.Job.find({ tenantId: tid, _id: { $in: ids } }).limit(100)).map(plain) : []; const by = {}; for (const j of jobs) by[String(j._id)] = j;
    res.json({ success: true, data: photos.map((x) => ({ id: x.id, at: x.createdAt, kind: x.kind, plate: (by[String(x.jobId)] || {}).plate || '', number: (by[String(x.jobId)] || {}).number, bytes: x.bytes, stored: x.store === 'local', url: x.store === 'local' ? '/api/wash/photos/' + x.id + '/file' : '' })) });
  }));
  router.post('/photos/:id/remove', ownerOnly, wrap(async (req, res, tid) => {
    const d = idOk(req.params.id) ? plain(await M.Photo.findOne({ _id: req.params.id, tenantId: tid })) : null; if (!d || !d._id) return fail(res, 404, 'Photo not found');
    if (d.store === 'local' && store && String(d.ref).startsWith(tid + '/')) await store.remove(d.ref);
    await M.Photo.deleteOne({ _id: req.params.id, tenantId: tid }); await audit(tid, req, 'photo.remove', `photo ${d.kind} of job ${String(d.jobId).slice(-6)} removed`);
    res.json({ success: true });
  }));

  // ---- job card page and bay ----
  router.get('/jobs/:id/card', wrap(async (req, res, tid) => {
    const job = plain(await jobOf(req, tid)); if (!job || !job._id) return fail(res, 404, 'Job not found');
    const [t, a] = await Promise.all([M.Tenant.findOne({ _id: tid }), job.attendantId ? M.Attendant.findOne({ _id: String(job.attendantId), tenantId: tid }) : null]);
    page(res, jobCardHtml({ job, businessName: t && t.businessName, attendant: a ? a.name : '' }));
  }));
  router.post('/jobs/:id/bay', wrap(async (req, res, tid) => {
    const job = plain(await jobOf(req, tid)); if (!job || !job._id) return fail(res, 404, 'Job not found');
    if (['delivered', 'cancelled'].includes(job.state)) return fail(res, 409, 'This job is finished.');
    const c = BAYS.checkBay((req.body || {}).bay); if (c.error) return fail(res, 400, c.error);
    await M.Job.updateOne({ _id: req.params.id, tenantId: tid }, { $set: { bay: c.value || '' } }); res.json({ success: true, data: { bay: c.value || '' } });
  }));
}
module.exports = mountWave3;
