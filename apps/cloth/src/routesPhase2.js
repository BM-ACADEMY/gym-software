'use strict';
// Cloth routes, Phase 2 (wave A). Written, not yet tested by a person. Every query filters by tenantId (the shop).
// Added in steps: 1 barcode/scan/fabric, 2 staff pay, 3 sales breakdown + Tally-style CSV, 5 data rights + audit, 6 stock count, 7 returns.
const BC = require('./barcode'); const PR = require('./payrollRules'); const SR = require('./salesReports'); const Ac = require('./accounts'); const PK = require('./pickup');

module.exports = ({ router, M, wrap, fail, str, todayIST, addDays, now, billsBetween, settingsOf }) => {
  const audit = (tid, req, action, text) => M.Audit.create({ tenantId: tid, action, text: String(text || '').slice(0, 200), by: req.user.id });
  const ownerOnly = (req, res) => (req.user.role === 'admin' ? null : fail(res, 403, 'Only the owner can do this.'));

  // ---- 1. barcode labels, scan, fabric by the metre ----
  const activeVariants = (tid) => M.Variant.find({ tenantId: tid, isActive: true }).sort({ style: 1 }).limit(2000).lean();
  router.get('/labels.csv', wrap(async (req, res, tid) => {
    const rows = BC.labelRows(await activeVariants(tid), { copies: req.query.copies });
    res.set('Content-Type', 'text/csv; charset=utf-8'); res.set('Content-Disposition', 'attachment; filename="labels.csv"'); res.set('Cache-Control', 'no-store'); res.send(BC.labelsCsv(rows));
  }));
  router.get('/labels.html', wrap(async (req, res, tid) => {
    const rows = BC.labelRows(await activeVariants(tid), { copies: req.query.copies });
    res.set('Content-Type', 'text/html; charset=utf-8'); res.set('Cache-Control', 'no-store'); res.send(BC.labelsHtml(rows));
  }));
  router.get('/variants/by-barcode/:code', wrap(async (req, res, tid) => {
    const code = BC.scanKey(req.params.code); if (!BC.barcodeOk(code)) return fail(res, 400, 'That barcode does not look right.');
    const v = await M.Variant.findOne({ barcode: code, tenantId: tid, isActive: true }).lean(); if (!v) return fail(res, 404, 'No item with that barcode.');
    const sc = BC.lineFromScan({ ...v, id: String(v._id) }, { qty: req.query.qty, metres: req.query.metres });
    res.json({ success: true, data: { variant: { id: String(v._id), style: v.style, size: v.size, colour: v.colour, mrp: v.mrp, currency: v.currency || 'INR', qty: v.qty, unit: v.unit || 'piece' }, line: sc.line || null, lineNote: sc.error || null } });
  }));
  router.post('/variants/:id/barcode', wrap(async (req, res, tid) => {
    const code = BC.scanKey(req.body && req.body.barcode); if (!BC.barcodeOk(code)) return fail(res, 400, 'Barcode: letters, numbers, dash, dot or slash, up to 40.');
    const u = await M.Variant.findOneAndUpdate({ _id: req.params.id, tenantId: tid, isActive: true }, { $set: { barcode: code } }, { returnDocument: 'after' }); if (!u) return fail(res, 404, 'Variant not found');
    res.json({ success: true, data: { id: String(u._id), barcode: u.barcode } });
  }, { write: true }));
  // Unit can change only while stock is zero (stock is in pieces or in centimetres, never mixed).
  router.post('/variants/:id/unit', wrap(async (req, res, tid) => {
    const unit = req.body && req.body.unit; if (!BC.UNITS.includes(unit)) return fail(res, 400, 'Unit must be piece or metre.');
    const u = await M.Variant.findOneAndUpdate({ _id: req.params.id, tenantId: tid, isActive: true, qty: 0 }, { $set: { unit } }, { returnDocument: 'after' });
    if (!u) return fail(res, 409, 'Change the unit only when the stock is zero.'); res.json({ success: true, data: { id: String(u._id), unit: u.unit } });
  }, { write: true }));
  // Fabric stock in/out in metres (stored as centimetres).
  router.post('/variants/:id/fabric-stock', wrap(async (req, res, tid) => {
    const v = await M.Variant.findOne({ _id: req.params.id, tenantId: tid, isActive: true, unit: 'metre' }); if (!v) return fail(res, 404, 'Fabric item not found (set its unit to metre first).');
    const type = req.body && req.body.type; if (!['purchase', 'adjust_out', 'wastage'].includes(type)) return fail(res, 400, 'Type must be purchase, adjust_out or wastage.');
    const cm = BC.metresToCm(req.body.metres); if (cm === null) return fail(res, 400, 'Enter metres with up to 2 decimals.');
    const next = v.qty + (type === 'purchase' ? cm : -cm); if (next < 0) return fail(res, 400, 'That is more than the stock.');
    const u = await M.Variant.findOneAndUpdate({ _id: v._id, tenantId: tid, qty: v.qty }, { $set: { qty: next } }, { returnDocument: 'after' }); if (!u) return fail(res, 409, 'Stock changed while you were saving. Try again.');
    await M.StockMove.create({ tenantId: tid, variantId: v._id, type, qty: cm, date: todayIST(now()), reason: str(req.body.reason, 200), by: req.user.id });
    res.json({ success: true, data: { id: String(u._id), stock: BC.metresText(u.qty) } });
  }, { write: true }));

  // ---- 2. shifts, leave, payslip ----
  const monthArg = (req) => { const m = str(req.query.month, 7) || todayIST(now()).slice(0, 7); return /^\d{4}-(0[1-9]|1[0-2])$/.test(m) ? m : null; };
  const staffOf = (tid, id) => M.Staff.findOne({ _id: id, tenantId: tid, isActive: true });
  router.put('/staff/:id/shift', wrap(async (req, res, tid) => {
    const g = ownerOnly(req, res); if (g) return g;
    const v = PR.validShift(req.body); if (v.error) return fail(res, 400, v.error);
    const u = await M.Staff.findOneAndUpdate({ _id: req.params.id, tenantId: tid, isActive: true }, { $set: { shift: v.value } }, { returnDocument: 'after' }); if (!u) return fail(res, 404, 'Staff member not found');
    await audit(tid, req, 'staff.shift', String(u._id)); res.json({ success: true, data: { id: String(u._id), shift: u.shift } });
  }, { write: true }));
  router.get('/staff/:id/leave', wrap(async (req, res, tid) => {
    const s = await staffOf(tid, req.params.id); if (!s) return fail(res, 404, 'Staff member not found');
    const month = monthArg(req); if (!month) return fail(res, 400, 'Month must look like 2026-11.');
    const marks = await M.Attendance.find({ tenantId: tid, staffId: s._id, date: { $gte: month.slice(0, 4) + '-01-01', $lte: month.slice(0, 4) + '-12-31' } }).lean();
    res.json({ success: true, data: PR.leaveFor({ allowance: (await settingsOf(tid)).leaveAllowance, marksYear: marks, month }) });
  }));
  router.get('/staff/:id/payslip', wrap(async (req, res, tid) => {
    const g = ownerOnly(req, res); if (g) return g;
    const s = await staffOf(tid, req.params.id); if (!s) return fail(res, 404, 'Staff member not found');
    const month = monthArg(req); if (!month) return fail(res, 400, 'Month must look like 2026-11.');
    const st = await settingsOf(tid); const last = new Date(Date.UTC(+month.slice(0, 4), +month.slice(5), 0)).getUTCDate();
    const marksYear = await M.Attendance.find({ tenantId: tid, staffId: s._id, date: { $gte: month.slice(0, 4) + '-01-01', $lte: month.slice(0, 4) + '-12-31' } }).lean();
    const marks = marksYear.filter((m) => m.date.slice(0, 7) === month);
    const bills = await billsBetween(tid, month + '-01', month + '-' + String(last).padStart(2, '0'));
    const shop = (await M.Tenant.findOne({ _id: tid }).lean() || {}).shopName;
    const p = PR.payslip({ shop, staff: { id: String(s._id), name: s.name, salary: s.salary }, month, marks, marksYear, daysInMonth: last, allowance: st.leaveAllowance, bills, rules: st.commissionRules });
    if (p.error) return fail(res, 400, p.error);
    await audit(tid, req, 'payslip.view', String(s._id) + ' ' + month);
    if (req.query.format === 'html') { res.set('Content-Type', 'text/html; charset=utf-8'); res.set('Cache-Control', 'no-store'); return res.send(PR.payslipHtml(p)); }
    res.json({ success: true, data: p });
  }));

  // ---- 3. sales by item, staff, hour; Tally-style CSV ----
  const range = (req) => { const today = todayIST(now()); const from = str(req.query.from, 10) || addDays(today, -29), to = str(req.query.to, 10) || today; return Ac.isDate(from) && Ac.isDate(to) && to >= from && (Date.parse(to) - Date.parse(from)) / 86400000 <= 400 ? { from, to } : null; };
  router.get('/reports/sales-breakdown', wrap(async (req, res, tid) => {
    const by = ['item', 'staff', 'hour'].includes(req.query.by) ? req.query.by : null; if (!by) return fail(res, 400, 'by must be item, staff or hour.');
    const r = range(req); if (!r) return fail(res, 400, 'Give a valid from and to date.');
    res.json({ success: true, data: SR.report(await billsBetween(tid, r.from, r.to), by) });
  }));
  router.get('/export/tally.csv', wrap(async (req, res, tid) => {
    const g = ownerOnly(req, res); if (g) return g;
    const r = range(req); if (!r) return fail(res, 400, 'Give a valid from and to date.');
    const bills = await billsBetween(tid, r.from, r.to); const ids = [...new Set(bills.map((b) => b.customerId).filter(Boolean))];
    const names = {}; if (ids.length && M.PosCustomer) for (const c of await M.PosCustomer.find({ tenantId: tid, _id: { $in: ids } }).select('name').lean()) names[String(c._id)] = c.name;
    await audit(tid, req, 'export.tally', r.from + ' to ' + r.to);
    res.set('Content-Type', 'text/csv; charset=utf-8'); res.set('Content-Disposition', 'attachment; filename="sales-vouchers.csv"'); res.set('Cache-Control', 'no-store'); res.send(SR.tallyCsv(bills, { names }));
  }));

  // ---- 4. pickup link for an alteration job ----
  router.post('/alterations/:id/pickup-link', wrap(async (req, res, tid) => {
    const j = await M.Alteration.findOne({ _id: req.params.id, tenantId: tid }); if (!j) return fail(res, 404, 'Job not found');
    const rotate = req.body && req.body.rotate === true; const token = !rotate && j.pickupToken ? j.pickupToken : PK.newToken();
    if (token !== j.pickupToken) await M.Alteration.updateOne({ _id: j._id, tenantId: tid }, { $set: { pickupToken: token } });
    await audit(tid, req, rotate ? 'pickup.rotate' : 'pickup.link', String(j._id));
    res.json({ success: true, data: { path: '/api/cloth-pickup/' + token, qrText: '/api/cloth-pickup/' + token, note: 'Give the customer the full link (your address plus this path) or print it as a QR. Rotating makes the old link stop working.' } });
  }, { write: true }));

  return { audit, ownerOnly };
};
