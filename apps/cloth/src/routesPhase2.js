'use strict';
// Cloth routes, Phase 2 (wave A). Written, not yet tested by a person. Every query filters by tenantId (the shop).
// Added in steps: 1 barcode/scan/fabric, 2 staff pay, 3 sales breakdown + Tally-style CSV, 5 data rights + audit, 6 stock count, 7 returns.
const BC = require('./barcode'); const PR = require('./payrollRules'); const SR = require('./salesReports'); const Ac = require('./accounts'); const PK = require('./pickup'); const DR = require('./dataRights'); const Lk = require('./leaks'); const RR = require('./returnsRules');

module.exports = ({ router, M, wrap, fail, str, todayIST, addDays, now, billsBetween, settingsOf }) => {
  const audit = (tid, req, action, text) => M.Audit.create({ tenantId: tid, action, text: String(text || '').slice(0, 200), by: req.user.id });
  const ownerOnly = (req, res) => { if (req.user.role === 'admin') return false; fail(res, 403, 'Only the owner can do this.'); return true; }; // true = refused, the answer is already sent

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
    if (ownerOnly(req, res)) return;
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
    if (ownerOnly(req, res)) return;
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
    if (ownerOnly(req, res)) return;
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

  // ---- 5. data export, delete on request, audit trail (owner only) ----
  router.get('/export/all.json', wrap(async (req, res, tid) => {
    if (ownerOnly(req, res)) return;
    const lim = (m, sort) => m.find({ tenantId: tid }).sort(sort || {}).limit(DR.CAP + 1).lean();
    const data = DR.shopExport({ tenant: await M.Tenant.findOne({ _id: tid }).lean(), variants: await lim(M.Variant), alterations: await lim(M.Alteration), staff: await lim(M.Staff), attendance: await lim(M.Attendance), expenses: await lim(M.Expense), dayCloses: await lim(M.DayClose), supplierBills: await lim(M.SupplierBill), customers: M.PosCustomer ? await lim(M.PosCustomer) : [], customerInfo: await lim(M.CustomerInfo), settings: await M.Settings.findOne({ tenantId: tid }).lean(), bills: await billsBetween(tid, '2020-01-01', todayIST(now())) });
    await audit(tid, req, 'export.all', 'full shop export');
    res.set('Content-Type', 'application/json; charset=utf-8'); res.set('Content-Disposition', 'attachment; filename="shop-data.json"'); res.set('Cache-Control', 'no-store'); res.send(JSON.stringify(data));
  }));
  // Delete = anonymise the person; bills stay (the shop must keep its sales and tax records).
  router.post('/customers/:id/delete', wrap(async (req, res, tid) => {
    if (ownerOnly(req, res)) return;
    if (!DR.confirmOk(req.body && req.body.confirm)) return fail(res, 400, 'Type DELETE to confirm. This removes the customer\'s name and phone. Bills stay for your records.');
    const c = M.PosCustomer ? await M.PosCustomer.findOne({ _id: req.params.id, tenantId: tid }) : null; if (!c) return fail(res, 404, 'Customer not found');
    const a = DR.anonymiseCustomer(now());
    await M.PosCustomer.updateOne({ _id: c._id, tenantId: tid }, a.customer);
    await M.CustomerInfo.updateOne({ tenantId: tid, customerId: c._id }, a.info);
    await M.Alteration.updateMany({ tenantId: tid, customerId: c._id }, a.alteration);
    await audit(tid, req, 'customer.anonymise', String(c._id));
    res.json({ success: true, message: 'The customer\'s name and contact details are removed. Their bills stay.' });
  }, { write: true }));
  router.get('/audit', wrap(async (req, res, tid) => {
    if (ownerOnly(req, res)) return;
    const rows = await M.Audit.find({ tenantId: tid }).sort({ createdAt: -1 }).limit(Math.min(Number(req.query.limit) || 100, 500)).lean();
    res.set('Cache-Control', 'no-store'); res.json({ success: true, data: rows.map((r) => ({ id: String(r._id), at: r.createdAt || null, action: r.action, text: r.text })) });
  }));

  // ---- 6. physical stock count and mismatch alert ----
  // counted: pieces (whole number) or, for fabric, metres. adjust:true also sets the system stock to the count (owner only).
  router.post('/variants/:id/count', wrap(async (req, res, tid) => {
    const v = await M.Variant.findOne({ _id: req.params.id, tenantId: tid, isActive: true }); if (!v) return fail(res, 404, 'Variant not found');
    const b = req.body || {}; const fabric = v.unit === 'metre';
    const counted = fabric ? BC.metresToCm(b.counted) : (Number.isInteger(b.counted) && b.counted >= 0 && b.counted <= 100000 ? b.counted : null);
    const zeroOk = fabric && Number(b.counted) === 0 ? 0 : counted; // 0 metres is a valid count
    if (zeroOk === null) return fail(res, 400, fabric ? 'Counted metres: up to 2 decimals.' : 'Counted pieces must be a whole number.');
    const diff = zeroOk - v.qty; const adjust = b.adjust === true;
    if (adjust && req.user.role !== 'admin') return fail(res, 403, 'Only the owner can change the system stock to match a count.');
    await M.StockMove.create({ tenantId: tid, variantId: v._id, type: 'count', qty: zeroOk, expected: v.qty, difference: diff, date: todayIST(now()), reason: str(b.reason, 200), by: req.user.id });
    if (adjust && diff !== 0) { const u = await M.Variant.findOneAndUpdate({ _id: v._id, tenantId: tid, qty: v.qty }, { $set: { qty: zeroOk } }); if (!u) return fail(res, 409, 'Stock changed while you were saving. Count again.'); await audit(tid, req, 'stock.count_adjust', `${String(v._id)} ${v.qty} -> ${zeroOk}`); }
    res.json({ success: true, data: { expected: v.qty, counted: zeroOk, difference: diff, adjusted: adjust && diff !== 0, unit: fabric ? 'centimetres' : 'pieces' } });
  }, { write: true }));
  router.get('/reports/stock-mismatch', wrap(async (req, res, tid) => {
    const since = addDays(todayIST(now()), -30);
    const moves = await M.StockMove.find({ tenantId: tid, type: 'count', date: { $gte: since } }).sort({ date: -1 }).limit(500).lean();
    const vs = await M.Variant.find({ tenantId: tid }).limit(5000).lean(); const byId = {}; vs.forEach((v) => { byId[String(v._id)] = v; });
    const rows = moves.map((m) => { const v = byId[String(m.variantId)] || {}; return { variantName: `${v.style || 'Item'} ${v.size || ''} ${v.colour || ''}`.trim(), expected: m.expected, counted: m.qty, date: m.date, unit: v.unit || 'piece' }; });
    res.json({ success: true, data: { note: 'Counts of the last 30 days that did not match. Hints, not proof.', items: Lk.stockMismatches(rows) } });
  }));

  // ---- 7. return or exchange: put the exact size and colour back in stock (money side: core-pos return-lines) ----
  router.post('/returns', wrap(async (req, res, tid) => {
    const b = req.body || {}; if (!/^[0-9a-fA-F]{24}$/.test(String(b.billId))) return fail(res, 400, 'Choose the bill.');
    const sales = await M.StockMove.find({ tenantId: tid, billId: b.billId, type: 'sale' }).lean(); if (!sales.length) return fail(res, 404, 'No sale with stock found for that bill.');
    const done = await M.StockMove.find({ tenantId: tid, billId: b.billId, type: 'return_in' }).lean();
    const vs = await M.Variant.find({ tenantId: tid }).limit(5000).lean(); const units = {}; vs.forEach((v) => { units[String(v._id)] = v.unit || 'piece'; });
    const p = RR.plan({ sales, done, items: b.items, units, reason: b.reason, kind: b.kind }); if (p.error) return fail(res, 400, p.error);
    const made = [];
    for (const m of p.moves) made.push({ m, row: await M.StockMove.create({ tenantId: tid, variantId: m.variantId, type: 'return_in', qty: m.qty, date: todayIST(now()), billId: b.billId, reason: `${p.kind}: ${p.reason}`, by: req.user.id }) });
    // Re-check after writing: two people returning the same item at once must not put stock back twice.
    const after = await M.StockMove.find({ tenantId: tid, billId: b.billId, type: 'return_in' }).lean(); const tot = {}; after.forEach((x) => { tot[String(x.variantId)] = (tot[String(x.variantId)] || 0) + x.qty; });
    const sold = {}; sales.forEach((x) => { sold[String(x.variantId)] = (sold[String(x.variantId)] || 0) + x.qty; });
    if (made.some((x) => tot[String(x.m.variantId)] > sold[String(x.m.variantId)])) { for (const x of made) await M.StockMove.updateOne({ _id: x.row._id, tenantId: tid }, { $set: { type: 'return_void' } }); return fail(res, 409, 'Another return was saved at the same time. Open the bill and try again.'); }
    for (const x of made) await M.Variant.findOneAndUpdate({ _id: x.m.variantId, tenantId: tid }, { $inc: { qty: x.m.qty } });
    await audit(tid, req, 'stock.' + p.kind, `${b.billId} ${p.moves.length} item(s): ${p.reason}`);
    res.status(201).json({ success: true, data: { restored: p.moves.length, kind: p.kind }, next: 'Now refund the money with Return on the bill (shared bill return), so points and pay-later are reversed too.' });
  }, { write: true }));

  return { audit, ownerOnly };
};
