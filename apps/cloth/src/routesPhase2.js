'use strict';
// Cloth routes, Phase 2 (wave A). Written, not yet tested by a person. Every query filters by tenantId (the shop).
// Added in steps: 1 barcode/scan/fabric, 2 staff pay, 3 sales breakdown + Tally-style CSV, 5 data rights + audit, 6 stock count, 7 returns.
const BC = require('./barcode');

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

  return { audit, ownerOnly };
};
