'use strict';
// Cloth routes, Phase 3 (CLO-13). Written, not yet tested by a person. Every query filters by tenantId (the shop).
// 1 public catalogue switch, 2 godown transfer, 3 shifts calendar, 4 item CSV import, 5 UPI payment link record.
const P3 = require('./phase3Rules'); const II = require('./itemImport'); const BC = require('./barcode');

module.exports = ({ router, M, wrap, fail, str, todayIST, settingsOf, now }) => {
  const audit = (tid, req, action, text) => M.Audit.create({ tenantId: tid, action, text: String(text || '').slice(0, 200), by: req.user.id });
  const ownerOnly = (req, res) => { if (req.user.role === 'admin') return false; fail(res, 403, 'Only the owner can do this.'); return true; };

  // ---- 1. catalogue: owner marks items public, then turns the link on. The link is a secret token; turning it off or renewing it kills the old link. ----
  router.put('/variants/:id/public', wrap(async (req, res, tid) => {
    if (ownerOnly(req, res)) return; const on = req.body && req.body.isPublic; if (typeof on !== 'boolean') return fail(res, 400, 'Say true or false.');
    const u = await M.Variant.findOneAndUpdate({ _id: req.params.id, tenantId: tid, isActive: true }, { $set: { isPublic: on } }, { returnDocument: 'after' }); if (!u) return fail(res, 404, 'Variant not found');
    res.json({ success: true, data: { id: String(u._id), isPublic: !!u.isPublic } });
  }, { write: true }));
  router.post('/catalogue/link', wrap(async (req, res, tid) => {
    if (ownerOnly(req, res)) return; const token = P3.newToken();
    await M.Settings.updateOne({ tenantId: tid }, { $set: { catalogueToken: token } }, { upsert: true }); await audit(tid, req, 'catalogue.on', 'link made');
    res.json({ success: true, data: { token, path: '/api/cloth-catalogue/' + token } });
  }, { write: true }));
  router.post('/catalogue/off', wrap(async (req, res, tid) => {
    if (ownerOnly(req, res)) return; await M.Settings.updateOne({ tenantId: tid }, { $set: { catalogueToken: '' } }, { upsert: true }); await audit(tid, req, 'catalogue.off', 'link off');
    res.json({ success: true, data: { on: false } });
  }, { write: true }));
  router.get('/catalogue/link', wrap(async (req, res, tid) => {
    if (ownerOnly(req, res)) return; const s = await M.Settings.findOne({ tenantId: tid }).lean();
    res.json({ success: true, data: { on: !!(s && s.catalogueToken), path: s && s.catalogueToken ? '/api/cloth-catalogue/' + s.catalogueToken : null } });
  }));

  // ---- 2. godown transfer: stock moves between the shop and a named godown, never made or lost ----
  router.get('/godown', wrap(async (req, res, tid) => {
    const rows = await M.GodownStock.find({ tenantId: tid }).limit(2000).lean(); const vs = await M.Variant.find({ tenantId: tid, isActive: true }).limit(2000).lean(); const by = new Map(vs.map((v) => [String(v._id), v]));
    res.json({ success: true, data: rows.filter((r) => r.qty > 0 && by.has(String(r.variantId))).map((r) => { const v = by.get(String(r.variantId)); return { variantId: String(r.variantId), style: v.style, size: v.size, colour: v.colour, godown: r.godown, qty: r.qty, unit: v.unit || 'piece' }; }) });
  }));
  router.post('/godown/transfer', wrap(async (req, res, tid) => {
    const b = req.body || {}; const v = await M.Variant.findOne({ _id: b.variantId, tenantId: tid, isActive: true }).lean(); if (!v) return fail(res, 404, 'Item not found.');
    const unit = v.unit || 'piece'; const g = String((String(b.from).toLowerCase() === P3.SHOP ? b.to : b.from) || '');
    const gs = P3.GODOWN_OK.test(g) ? await M.GodownStock.findOne({ tenantId: tid, variantId: v._id, godown: g }).lean() : null;
    const plan = P3.transferPlan({ from: b.from, to: b.to, qty: b.qty, unit, shopQty: v.qty, godownQty: gs ? gs.qty : 0 }); if (plan.error) return fail(res, 400, plan.error);
    const n = plan.qty;
    if (plan.shopDelta < 0) { // shop to godown
      const a = await M.Variant.findOneAndUpdate({ _id: v._id, tenantId: tid, qty: { $gte: n } }, { $inc: { qty: -n } }, { returnDocument: 'after' }); if (!a) return fail(res, 409, 'Stock changed while you were saving. Try again.');
      await M.GodownStock.findOneAndUpdate({ tenantId: tid, variantId: v._id, godown: plan.godown }, { $inc: { qty: n } }, { upsert: true, returnDocument: 'after' });
    } else { // godown to shop
      const a = await M.GodownStock.findOneAndUpdate({ tenantId: tid, variantId: v._id, godown: plan.godown, qty: { $gte: n } }, { $inc: { qty: -n } }, { returnDocument: 'after' }); if (!a) return fail(res, 409, 'Godown stock changed while you were saving. Try again.');
      await M.Variant.findOneAndUpdate({ _id: v._id, tenantId: tid }, { $inc: { qty: n } }, { returnDocument: 'after' });
    }
    await M.StockMove.create({ tenantId: tid, variantId: v._id, type: 'transfer', qty: n, date: todayIST(now()), reason: (plan.shopDelta < 0 ? 'shop to ' : plan.godown + ' to shop: ') + (plan.shopDelta < 0 ? plan.godown : 'shop'), by: req.user.id });
    await audit(tid, req, 'stock.transfer', String(v._id) + ' ' + plan.godown + ' ' + plan.shopDelta);
    res.json({ success: true, data: { variantId: String(v._id), godown: plan.godown, moved: unit === 'metre' ? BC.metresText(n) : n, shopDelta: plan.shopDelta } });
  }, { write: true }));

  // ---- 3. shifts calendar: planned shifts from each weekly pattern beside what was marked; days with no mark are flagged as gaps ----
  router.get('/shifts/calendar', wrap(async (req, res, tid) => {
    const month = str(req.query.month, 7) || todayIST(now()).slice(0, 7);
    const staff = (await M.Staff.find({ tenantId: tid, isActive: true }).limit(200).lean()).map((s) => ({ id: String(s._id), name: s.name, shift: s.shift }));
    const marks = await M.Attendance.find({ tenantId: tid, date: { $gte: month + '-01', $lte: month + '-31' } }).lean();
    const c = P3.shiftCalendar({ staff, marks, month }); if (c.error) return fail(res, 400, c.error); res.json({ success: true, data: c });
  }));

  // ---- 4. item CSV import: preview changes nothing; confirm saves only the rows that pass, after re-checking on the server ----
  const checkCsv = async (req, res, tid) => {
    const text = req.body && req.body.csv; if (typeof text !== 'string' || !text.trim()) { fail(res, 400, 'Send the CSV text.'); return null; }
    const vs = await M.Variant.find({ tenantId: tid }).limit(20000).lean();
    const pv = II.preview(text, { existingKeys: new Set(vs.map((v) => v.key)), existingBarcodes: new Set(vs.map((v) => v.barcode).filter(Boolean)), bands: (await settingsOf(tid)).gstBands });
    if (pv.error) { fail(res, 400, pv.error); return null; } return pv;
  };
  router.post('/items/import/preview', wrap(async (req, res, tid) => {
    if (ownerOnly(req, res)) return; const pv = await checkCsv(req, res, tid); if (!pv) return;
    res.json({ success: true, data: { total: pv.total, ok: pv.rows.length, rows: pv.rows.slice(0, 50), errors: pv.errors.slice(0, 100), errorCount: pv.errors.length } });
  }));
  router.post('/items/import/confirm', wrap(async (req, res, tid) => {
    if (ownerOnly(req, res)) return; const pv = await checkCsv(req, res, tid); if (!pv) return; let added = 0;
    for (const r of pv.rows) {
      const { line, ...v } = r; if (v.gstRate == null) delete v.gstRate; if (v.cost === undefined) delete v.cost; if (!v.barcode) delete v.barcode; if (!v.category) delete v.category;
      const d = await M.Variant.create({ ...v, tenantId: tid, currency: 'INR', addedOn: todayIST(now()), isActive: true }); added++;
      if (v.qty > 0) await M.StockMove.create({ tenantId: tid, variantId: d._id, type: 'opening', qty: v.qty, date: todayIST(now()), reason: 'CSV import', by: req.user.id });
    }
    await audit(tid, req, 'items.import', added + ' added, ' + pv.errors.length + ' skipped'); res.json({ success: true, data: { added, skipped: pv.errors.length } });
  }, { write: true }));

  // ---- 5. UPI payment link record: we make the link; we cannot see the money, so the owner marks it paid after checking the UPI app ----
  router.post('/upi-links', wrap(async (req, res, tid) => {
    const s = await settingsOf(tid); const t = await M.Tenant.findOne({ _id: tid }).lean(); const b = req.body || {};
    const r = P3.upiLink({ upiId: s.upiId, name: t && t.shopName, amount: b.amount, note: str(b.note, 40) }); if (r.error) return fail(res, 400, r.error);
    const d = await M.UpiLink.create({ tenantId: tid, amount: r.value.amount, currency: 'INR', note: str(b.note, 40), url: r.value.url, status: 'pending', by: req.user.id });
    res.json({ success: true, data: { id: String(d._id), url: r.value.url, amount: r.value.amount, currency: 'INR', status: 'pending' } });
  }, { write: true }));
  router.get('/upi-links', wrap(async (req, res, tid) => res.json({ success: true, data: (await M.UpiLink.find({ tenantId: tid }).sort({ createdAt: -1 }).limit(100).lean()).map((d) => ({ id: String(d._id), amount: d.amount, currency: d.currency, note: d.note, status: d.status, paidOn: d.paidOn })) })));
  router.post('/upi-links/:id/paid', wrap(async (req, res, tid) => {
    if (ownerOnly(req, res)) return;
    const u = await M.UpiLink.findOneAndUpdate({ _id: req.params.id, tenantId: tid, status: 'pending' }, { $set: { status: 'paid', paidOn: todayIST(now()) } }, { returnDocument: 'after' }); if (!u) return fail(res, 404, 'No pending payment link found.');
    await audit(tid, req, 'upi.paid', String(u._id) + ' ' + u.amount); res.json({ success: true, data: { id: String(u._id), status: 'paid' } });
  }, { write: true }));
};
