'use strict';
// Runs in front of the shared bill route (POST /api/pos/bills) for Cloth. Written, not yet tested by a person.
//  D-30: staff discounts follow the owner's rule from Settings; the bill is refused if staff go over it; who and how much is saved
//        (ClothBillDiscount + audit line) so the owner always knows. The owner is never limited.
//  CLO-05: a bill line may carry a variantId. The price and GST come from this shop's own variant (never from the request),
//        stock is taken first (refused when short), and given back if the bill is not saved.
// core-pos itself is unchanged; a proper hook inside core-pos is proposed instead of this wrapper (see BUILD_STATUS.md).
const bill = require('../../../packages/core-pos/src/bill');
const DP = require('./discountPolicy');
const ID = /^[0-9a-fA-F]{24}$/;
const istDay = (d) => new Date(d.getTime() + 5.5 * 3600000).toISOString().slice(0, 10);

module.exports = ({ M, now = () => new Date() }) => async (req, res, next) => {
  if (req.method !== 'POST' || req.path !== '/bills') return next();
  const fail = (code, message) => res.status(code).json({ success: false, message });
  const tid = req.user.tenantId; const b = req.body || {}; const reserved = [];
  const giveBack = async () => { for (const r of reserved) await M.Variant.findOneAndUpdate({ _id: r.v._id, tenantId: tid }, { $inc: { qty: r.qty } }); };
  try {
    const raw = Array.isArray(b.lines) ? b.lines.slice(0, 100) : []; const pricing = []; const rewritten = []; const plan = [];
    for (const l of raw) {
      if (l && l.variantId) {
        if (!ID.test(String(l.variantId))) return fail(400, 'Bad item id.');
        const v = await M.Variant.findOne({ _id: l.variantId, tenantId: tid, isActive: true });
        if (!v) return fail(404, 'An item on the bill was not found.');
        const qty = Number(l.qty); if (!Number.isInteger(qty) || qty < 1) return fail(400, 'Quantity must be a whole number of pieces.');
        const line = { name: `${v.style} ${v.size} ${v.colour}`, unitPrice: v.mrp, qty, gstRate: v.gstRate, discount: l.discount, staffId: l.staffId };
        rewritten.push(line); pricing.push(line); plan.push({ v, qty });
      } else if (l && l.itemId) {
        const item = await M.PosItem.findOne({ _id: l.itemId, tenantId: tid, isActive: true });
        rewritten.push(l); if (item) pricing.push({ name: item.name, unitPrice: item.price, qty: Number(l.qty), gstRate: item.gstRate, discount: l.discount });
      } else { rewritten.push(l); pricing.push({ name: l && l.name, unitPrice: l && l.unitPrice, qty: Number(l && l.qty), gstRate: (l && l.gstRate) || 0, discount: l && l.discount }); }
    }
    req.body = { ...b, lines: rewritten };
    let calc; try { calc = bill.compute({ lines: pricing, billDiscount: b.billDiscount, taxMode: b.taxMode || 'none', gstMode: b.gstMode || 'cgst_sgst' }); } catch (e) { return next(); } // the route gives the same error
    if (pricing.length !== rewritten.length) return next(); // an item is missing: the route answers 404
    const role = req.user.role === 'admin' ? 'admin' : 'staff';
    const s = await M.Settings.findOne({ tenantId: tid }).lean();
    const dc = DP.check({ role, discount: calc.discount, subtotal: calc.subtotal, rule: s && s.discountRule });
    if (!dc.ok) return fail(403, dc.message);

    const day = istDay(now());
    for (const p of plan) {
      const got = await M.Variant.findOneAndUpdate({ _id: p.v._id, tenantId: tid, qty: { $gte: p.qty } }, { $inc: { qty: -p.qty }, $set: { lastSoldOn: day } });
      if (!got) { await giveBack(); return fail(409, `Not enough stock for ${p.v.style} ${p.v.size} ${p.v.colour}.`); }
      reserved.push(p);
    }
    const send = res.json.bind(res);
    res.json = async (body) => {
      try {
        if (res.statusCode === 201 && body && body.success && body.data) {
          for (const r of reserved) await M.StockMove.create({ tenantId: tid, variantId: r.v._id, type: 'sale', qty: r.qty, date: day, billId: body.data._id, reason: 'bill ' + body.data.number, by: req.user.id });
          if (calc.discount > 0) {
            const by = role === 'admin' ? 'owner' : 'staff';
            await M.BillDiscount.create({ tenantId: tid, billId: body.data._id, number: body.data.number, date: day, discount: calc.discount, subtotal: calc.subtotal, percent: dc.percent, by, userId: req.user.id, reason: typeof b.discountReason === 'string' ? b.discountReason.trim().slice(0, 120) : undefined });
            await M.Audit.create({ tenantId: tid, action: 'bill.discount', text: `${body.data.number} ${dc.percent}% by ${by}`, by: req.user.id });
          }
        } else await giveBack(); // not saved (duplicate retry, validation, short payment...): stock goes back
      } catch (e) { console.error('Cloth bill hook failed:', e.message); }
      return send(body);
    };
    return next();
  } catch (e) { await giveBack(); console.error('Cloth bill guard failed:', e.message); return res.status(500).json({ success: false, message: 'Server error' }); }
};
