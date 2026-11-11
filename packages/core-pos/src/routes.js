// Express router for the shared shop features. A product mounts it like this:
//   app.use('/api/pos', createPosRouter({ express, mongoose, protect, authorize, tenantOf: (req) => req.user.subscriberId, roles: ['admin','subadmin'] }));
// `protect` and `authorize` are the product's own sign-in checks (injected so this package never imports a product).
const bill = require('./bill');
const loyalty = require('./loyalty');
const stock = require('./stock');
const makeModels = require('./models');
const csv = require('./csvImport');
const returns = require('./returns');
const billHtml = require('./billHtml');

const fyOf = (date) => {
  const ist = new Date(new Date(date).getTime() + 5.5 * 3600000);
  const y = ist.getUTCFullYear(); const start = ist.getUTCMonth() >= 3 ? y : y - 1;
  return `${start}-${String((start + 1) % 100).padStart(2, '0')}`;
};
const str = (v, max = 120) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const num = (v) => (v === '' || v === null || v === undefined ? undefined : Number(v));

// Optional hooks (POS-01). A product passes them to enforce its own rules in one place:
//   beforeBill({ req, tid, body, calc }): runs after the bill is worked out and before any stock is taken or anything saved.
//     It may throw an error with code 'BILL_INVALID' (answers 400) or 'BILL_FORBIDDEN' (answers 403), or return
//     { fields: { discountBy, discountPercent, discountReason } } which is saved on the bill itself (only those three keys).
//   afterBill({ req, tid, doc, calc }): runs after the bill is saved; a failure here is logged and never undoes the bill.
module.exports = ({ express, mongoose, protect, authorize, tenantOf, roles = ['admin', 'subadmin'], loyaltyRules, prefix = 'BILL', shopOf, beforeBill, afterBill }) => {
  const router = express.Router();
  const M = makeModels(mongoose);
  router.use(protect, authorize(...roles));

  const fail = (res, code, message) => res.status(code).json({ success: false, message });
  const wrap = (fn) => async (req, res) => {
    try { await fn(req, res, tenantOf(req)); } catch (err) {
      if (err.code === 'BILL_FORBIDDEN') return fail(res, 403, err.message);
      if (['BILL_INVALID', 'LOYALTY_INVALID', 'STOCK_INVALID'].includes(err.code)) return fail(res, 400, err.message);
      if (err.code === 11000) return fail(res, 409, 'That value is already used.');
      if (err.name === 'ValidationError' || err.name === 'CastError') return fail(res, 400, 'Check the values you entered.');
      console.error('POS route failed:', err.message);
      return fail(res, 500, 'Server error');
    }
  };

  // ---- customers (phone is the key) ----
  router.get('/customers', wrap(async (req, res, tid) => {
    const q = { tenantId: tid, isActive: true };
    const s = str(req.query.q, 40);
    if (s) q.$or = [{ name: new RegExp(s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') }, { phone: s }];
    res.json({ success: true, data: await M.PosCustomer.find(q).sort({ name: 1 }).limit(50) });
  }));
  router.post('/customers', wrap(async (req, res, tid) => {
    const c = await M.PosCustomer.create({ tenantId: tid, name: str(req.body.name), phone: str(req.body.phone, 15) || undefined, email: str(req.body.email) || undefined, note: str(req.body.note, 300) });
    res.status(201).json({ success: true, data: c });
  }));
  router.get('/customers/:id', wrap(async (req, res, tid) => {
    const c = await M.PosCustomer.findOne({ _id: req.params.id, tenantId: tid });
    if (!c) return fail(res, 404, 'Customer not found');
    const ledger = await M.PosLoyalty.find({ tenantId: tid, customerId: c._id }).select('points');
    res.json({ success: true, data: { customer: c, points: loyalty.balanceOf(ledger) } });
  }));

  // ---- items and stock ----
  router.get('/items', wrap(async (req, res, tid) => {
    const q = { tenantId: tid, isActive: true };
    if (req.query.barcode) q.barcode = str(req.query.barcode, 40);
    res.json({ success: true, data: await M.PosItem.find(q).sort({ name: 1 }).limit(500) });
  }));
  router.post('/items', wrap(async (req, res, tid) => {
    const b = req.body;
    if (!bill.GST_SLABS.includes(Number(b.gstRate || 0))) return fail(res, 400, 'GST rate is not a standard slab.');
    const item = await M.PosItem.create({ tenantId: tid, kind: b.kind === 'service' ? 'service' : 'item', name: str(b.name), sku: str(b.sku, 40) || undefined, barcode: str(b.barcode, 40) || undefined,
      price: Math.round(Number(b.price)), gstRate: Number(b.gstRate || 0), trackStock: b.kind !== 'service' && b.trackStock === true, qty: Math.max(0, Number(b.qty) || 0),
      reorderLevel: num(b.reorderLevel), expiresAt: b.expiresAt ? new Date(b.expiresAt) : undefined });
    res.status(201).json({ success: true, data: item });
  }));
  router.post('/items/:id/stock', wrap(async (req, res, tid) => {
    const item = await M.PosItem.findOne({ _id: req.params.id, tenantId: tid, trackStock: true });
    if (!item) return fail(res, 404, 'Item not found or stock is not tracked for it');
    const move = { type: str(req.body.type, 20), qty: Number(req.body.qty) };
    const next = stock.apply(item.qty, move); // throws on a bad type or too little stock
    const updated = await M.PosItem.findOneAndUpdate({ _id: item._id, tenantId: tid, qty: item.qty }, { $set: { qty: next } }, { returnDocument: 'after' });
    if (!updated) return fail(res, 409, 'Stock changed while you were saving. Try again.');
    await M.PosStockMove.create({ tenantId: tid, itemId: item._id, ...move, reason: str(req.body.reason, 200), by: req.user.id });
    res.json({ success: true, data: updated });
  }));
  router.get('/reports/low-stock', wrap(async (req, res, tid) => {
    const items = await M.PosItem.find({ tenantId: tid, trackStock: true, isActive: true }).lean();
    res.json({ success: true, data: stock.lowStock(items) });
  }));
  router.get('/reports/expiring', wrap(async (req, res, tid) => {
    const items = await M.PosItem.find({ tenantId: tid, trackStock: true, isActive: true, expiresAt: { $ne: null } }).lean();
    res.json({ success: true, data: stock.expiring(items, new Date(), Math.min(Number(req.query.days) || 30, 365)) });
  }));


  // ---- CSV import (preview first, then save). Send at most 1000 rows per request; the screen splits bigger files. ----
  router.post('/import/items', wrap(async (req, res, tid) => {
    const parsed = csv.parseItems(str(req.body.csv, 600000));
    const commit = req.body.commit === true;
    const existing = new Set();
    if (parsed.ok.length) {
      const found = await M.PosItem.find({ tenantId: tid, $or: [{ barcode: { $in: parsed.ok.map((r) => r.barcode).filter(Boolean) } }, { name: { $in: parsed.ok.map((r) => r.name) } }] }).select('name barcode').lean();
      found.forEach((f) => { if (f.barcode) existing.add(`b:${f.barcode}`); existing.add(`n:${f.name.toLowerCase()}`); });
    }
    const toAdd = []; const skipped = [];
    for (const r of parsed.ok) {
      if ((r.barcode && existing.has(`b:${r.barcode}`)) || existing.has(`n:${r.name.toLowerCase()}`)) skipped.push({ row: r._row, message: `"${r.name}" is already in your item list. Not changed.` });
      else toAdd.push(r);
    }
    let added = 0;
    if (commit) {
      for (const r of toAdd) {
        const { _row, ...rest } = r;
        const doc = await M.PosItem.create({ tenantId: tid, kind: 'item', ...rest, trackStock: rest.qty > 0 || rest.reorderLevel != null });
        if (rest.qty > 0) await M.PosStockMove.create({ tenantId: tid, itemId: doc._id, type: 'opening', qty: rest.qty, reason: 'CSV import', by: req.user.id });
        added += 1;
      }
    }
    res.json({ success: true, data: { committed: commit, willAdd: toAdd.length, added, skipped, errors: parsed.errors, columnsRead: Object.values(parsed.map), preview: toAdd.slice(0, 5) } });
  }));

  router.post('/import/customers', wrap(async (req, res, tid) => {
    const parsed = csv.parseCustomers(str(req.body.csv, 600000));
    const commit = req.body.commit === true;
    const have = new Set((await M.PosCustomer.find({ tenantId: tid, phone: { $in: parsed.ok.map((r) => r.phone).filter(Boolean) } }).select('phone').lean()).map((c) => c.phone));
    const toAdd = []; const skipped = [];
    for (const r of parsed.ok) { if (r.phone && have.has(r.phone)) skipped.push({ row: r._row, message: `${r.phone} is already a customer. Not changed.` }); else toAdd.push(r); }
    let added = 0;
    if (commit) {
      for (const r of toAdd) {
        const { _row, credit, points, ...rest } = r;
        const c = await M.PosCustomer.create({ tenantId: tid, ...rest, creditDue: credit || 0 });
        if (points > 0) await M.PosLoyalty.create({ tenantId: tid, customerId: c._id, points, reason: 'opening' });
        added += 1;
      }
    }
    res.json({ success: true, data: { committed: commit, willAdd: toAdd.length, added, skipped, errors: parsed.errors, columnsRead: Object.values(parsed.map), preview: toAdd.slice(0, 5) } });
  }));

  // ---- bills ----
  const nextNumber = async (tid, now) => {
    const fy = fyOf(now);
    const c = await M.PosCounter.findOneAndUpdate({ tenantId: tid, key: `bill:${fy}` }, { $inc: { seq: 1 } }, { upsert: true, returnDocument: 'after' });
    return `${prefix}/${fy}/${String(c.seq).padStart(4, '0')}`;
  };

  router.post('/bills', wrap(async (req, res, tid) => {
    const b = req.body || {};
    const clientId = str(b.clientId, 60) || undefined;
    if (clientId) { // an offline device retrying: return the bill already saved
      const existing = await M.PosBill.findOne({ tenantId: tid, clientId });
      if (existing) return res.status(200).json({ success: true, data: existing, duplicate: true });
    }
    let customer = null;
    if (b.customerId) { customer = await M.PosCustomer.findOne({ _id: b.customerId, tenantId: tid }); if (!customer) return fail(res, 404, 'Customer not found'); }

    // lines: items come from this shop's own list, so prices and tax cannot be faked from outside
    const rawLines = Array.isArray(b.lines) ? b.lines.slice(0, 100) : [];
    const lines = []; const tracked = [];
    for (const l of rawLines) {
      if (l.itemId) {
        const item = await M.PosItem.findOne({ _id: l.itemId, tenantId: tid, isActive: true });
        if (!item) return fail(res, 404, 'An item on the bill was not found.');
        lines.push({ name: item.name, kind: item.kind, unitPrice: item.price, qty: Number(l.qty), gstRate: item.gstRate, discount: l.discount, staffId: l.staffId, itemId: item._id });
        if (item.trackStock) tracked.push({ id: item._id, qty: Number(l.qty), name: item.name });
      } else {
        lines.push({ name: str(l.name), kind: 'item', unitPrice: l.unitPrice, qty: Number(l.qty), gstRate: l.gstRate || 0, discount: l.discount, staffId: l.staffId });
      }
    }
    const calc = bill.compute({ lines, billDiscount: b.billDiscount, taxMode: b.taxMode || 'none', gstMode: b.gstMode || 'cgst_sgst' });

    let hookFields = {};
    if (typeof beforeBill === 'function') {
      const h = await beforeBill({ req, tid, body: b, calc });
      const f = (h && h.fields) || {};
      if (['owner', 'staff'].includes(f.discountBy)) hookFields.discountBy = f.discountBy;
      if (Number.isFinite(f.discountPercent)) hookFields.discountPercent = Math.round(f.discountPercent);
      if (typeof f.discountReason === 'string') hookFields.discountReason = f.discountReason.trim().slice(0, 120);
    }
    const payments = Array.isArray(b.payments) ? b.payments.map((p) => ({ method: p.method, amount: p.amount })) : [];
    let pointsUsed = 0;
    if (Number(b.redeemPoints) > 0) {
      if (!customer) return fail(res, 400, 'Choose a customer to use points.');
      const bal = loyalty.balanceOf(await M.PosLoyalty.find({ tenantId: tid, customerId: customer._id }).select('points'));
      const r = loyalty.redeem({ requestedPoints: b.redeemPoints, balance: bal, billTotal: calc.total }, loyaltyRules);
      pointsUsed = r.points;
      if (r.rupees > 0) payments.push({ method: 'loyalty', amount: r.rupees });
    }
    if (payments.some((p) => p.method === 'credit') && !customer) return fail(res, 400, 'Pay-later needs a customer.');
    const s = bill.settle(calc.total, payments);

    // take stock first, one item at a time; undo what was taken if any item is short
    const taken = [];
    for (const t of tracked) {
      const got = await M.PosItem.findOneAndUpdate({ _id: t.id, tenantId: tid, qty: { $gte: t.qty } }, { $inc: { qty: -t.qty } });
      if (!got) { for (const u of taken) await M.PosItem.updateOne({ _id: u.id, tenantId: tid }, { $inc: { qty: u.qty } }); return fail(res, 409, `Not enough stock for ${t.name}.`); }
      taken.push(t);
    }
    try {
      const now = new Date();
      const doc = await M.PosBill.create({ tenantId: tid, number: await nextNumber(tid, now), customerId: customer?._id, lines: calc.lines,
        subtotal: calc.subtotal, discount: calc.discount, taxable: calc.taxable, gst: calc.gst, cgst: calc.cgst, sgst: calc.sgst, igst: calc.igst, total: calc.total,
        taxMode: calc.taxMode, gstMode: calc.gstMode, currency: 'INR', payments, received: s.received, change: s.change, credit: s.credit, due: s.due, status: s.status === 'credit' ? 'credit' : s.status,
        pointsUsed, pointsEarned: 0, clientId, by: req.user.id, ...hookFields });
      for (const t of taken) await M.PosStockMove.create({ tenantId: tid, itemId: t.id, type: 'sale', qty: t.qty, billId: doc._id, by: req.user.id });
      if (customer) {
        const earned = loyalty.earn(s.received - payments.filter((p) => p.method === 'loyalty' || p.method === 'giftcard').reduce((a, p) => a + Math.round(Number(p.amount) || 0), 0), loyaltyRules);
        if (pointsUsed) await M.PosLoyalty.create({ tenantId: tid, customerId: customer._id, points: -pointsUsed, reason: 'redeemed', billId: doc._id });
        if (earned) await M.PosLoyalty.create({ tenantId: tid, customerId: customer._id, points: earned, reason: 'earned', billId: doc._id });
        if (s.credit) await M.PosCustomer.updateOne({ _id: customer._id, tenantId: tid }, { $inc: { creditDue: s.credit } });
        if (earned) { doc.pointsEarned = earned; await doc.save(); }
      }
      if (typeof afterBill === 'function') { try { await afterBill({ req, tid, doc, calc }); } catch (e) { console.error('afterBill failed:', e.message); } }
      res.status(201).json({ success: true, data: doc });
    } catch (err) {
      for (const u of taken) await M.PosItem.updateOne({ _id: u.id, tenantId: tid }, { $inc: { qty: u.qty } }); // bill not saved: give the stock back
      throw err;
    }
  }));

  router.get('/bills', wrap(async (req, res, tid) => {
    res.json({ success: true, data: await M.PosBill.find({ tenantId: tid }).sort({ createdAt: -1 }).limit(Math.min(Number(req.query.limit) || 50, 200)) });
  }));
  router.get('/bills/:id', wrap(async (req, res, tid) => {
    const doc = await M.PosBill.findOne({ _id: req.params.id, tenantId: tid });
    if (!doc) return fail(res, 404, 'Bill not found');
    res.json({ success: true, data: doc });
  }));

  // Printable bill page (A4/A5). The app passes shopOf(req) -> { name, address?, phone?, gstin?, footer? } from its own shop settings.
  // Needs the sign-in header, so the screen fetches it and opens it as a local page (see openBillPage in core-ui); the bill is looked up by tenant.
  router.get('/bills/:id/print', wrap(async (req, res, tid) => {
    if (typeof shopOf !== 'function') return fail(res, 400, 'Shop details are not set up for printing.');
    const doc = await M.PosBill.findOne({ _id: req.params.id, tenantId: tid });
    if (!doc) return fail(res, 404, 'Bill not found');
    const shop = await shopOf(req);
    if (!shop || !shop.name) return fail(res, 400, 'Add your shop name in Settings to print bills.');
    const size = req.query.size === 'A4' ? 'A4' : 'A5';
    const lang = ['ta', 'hi'].includes(req.query.lang) ? req.query.lang : 'en';
    let customerName; let customerPhone;
    if (doc.customerId) { const c = await M.PosCustomer.findOne({ _id: doc.customerId, tenantId: tid }); if (c) { customerName = c.name; customerPhone = c.phone; } }
    const at = new Date(doc.createdAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', hour12: false });
    const html = billHtml.render(doc.toObject ? doc.toObject() : doc, shop, { size, lang, at, customerName, customerPhone });
    res.set('Content-Type', 'text/html; charset=utf-8');
    res.set('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'; img-src data:");
    res.set('X-Content-Type-Options', 'nosniff');
    res.send(html);
  }));

  // Part return: pick lines and quantities. Safe to double-click: the bill is only changed if nobody returned anything in between.
  router.post('/bills/:id/return-lines', wrap(async (req, res, tid) => {
    const doc = await M.PosBill.findOne({ _id: req.params.id, tenantId: tid });
    if (!doc) return fail(res, 404, 'Bill not found');
    if (doc.status === 'returned') return fail(res, 409, 'Bill already returned.');
    const p = returns.plan({ bill: doc.toObject(), items: req.body && req.body.items, returnedQty: doc.returnedQty });
    const done = await M.PosBill.findOneAndUpdate(
      { _id: doc._id, tenantId: tid, status: { $ne: 'returned' }, returnedQty: doc.returnedQty },
      { $set: { returnedQty: p.nextReturnedQty, returnedAmount: p.returnedAmount, ...(p.fullyReturned ? { status: 'returned' } : {}) } });
    if (!done) return fail(res, 409, 'The bill changed while you were saving. Open it again.');
    for (const s of p.stockBack) {
      const r = await M.PosItem.findOneAndUpdate({ _id: s.itemId, tenantId: tid, trackStock: true }, { $inc: { qty: s.qty } });
      if (r) await M.PosStockMove.create({ tenantId: tid, itemId: s.itemId, type: 'return_in', qty: s.qty, billId: doc._id, by: req.user.id });
    }
    if (doc.customerId) {
      if (p.points) await M.PosLoyalty.create({ tenantId: tid, customerId: doc.customerId, points: p.points, reason: 'part_return', billId: doc._id });
      if (p.creditReduction) await M.PosCustomer.updateOne({ _id: doc.customerId, tenantId: tid }, { $inc: { creditDue: -p.creditReduction } });
    }
    res.json({ success: true, data: { refund: p.refund, cashBack: p.cashBack, creditReduction: p.creditReduction, pointsBack: p.loyaltyBack, fullyReturned: p.fullyReturned } });
  }));

  // Whole-bill return: puts stock back and reverses points and pay-later. If some lines were already part-returned, use the line return for the rest.
  router.post('/bills/:id/return', wrap(async (req, res, tid) => {
    const doc = await M.PosBill.findOneAndUpdate({ _id: req.params.id, tenantId: tid, status: { $ne: 'returned' }, returnedAmount: { $in: [0, null] } }, { $set: { status: 'returned' } }, { returnDocument: 'before' });
    if (!doc) return fail(res, 409, 'Bill not found, already returned, or partly returned (return the remaining lines instead).');
    for (const l of doc.lines) {
      if (!l.itemId) continue;
      const r = await M.PosItem.findOneAndUpdate({ _id: l.itemId, tenantId: tid, trackStock: true }, { $inc: { qty: l.qty } });
      if (r) await M.PosStockMove.create({ tenantId: tid, itemId: l.itemId, type: 'return_in', qty: l.qty, billId: doc._id, by: req.user.id });
    }
    if (doc.customerId) {
      const rev = loyalty.reverseForReturn({ earned: doc.pointsEarned || 0, redeemed: doc.pointsUsed || 0 });
      if (rev.points) await M.PosLoyalty.create({ tenantId: tid, customerId: doc.customerId, points: rev.points, reason: 'returned', billId: doc._id });
      if (doc.credit) await M.PosCustomer.updateOne({ _id: doc.customerId, tenantId: tid }, { $inc: { creditDue: -doc.credit } });
    }
    res.json({ success: true, message: 'Bill returned.' });
  }));

  return router;
};
