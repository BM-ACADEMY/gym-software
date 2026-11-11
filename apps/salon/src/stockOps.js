'use strict';
// The guarded writes for stock (used by the bill route and the stock routes). Each takes the models; no express here.
// Consumption never blocks a bill (a busy salon cannot stop to fix stock): stock may go below zero and the owner's alert list says so.
const { usageForBill } = require('./stock');

async function consumeForBill(M, tid, bill, services, by) {
  const use = usageForBill(bill.lines, services); if (!use.length) return 0; let n = 0;
  for (const u of use) {
    const p = await M.Product.findOneAndUpdate({ _id: u.productId, tenantId: tid, isActive: true }, { $inc: { stock: -u.qty } }, { new: true }); if (!p) continue;
    await M.StockMove.create({ tenantId: tid, productId: p._id, qty: -u.qty, reason: (bill.lines || []).some((l) => String(l.productId) === String(p._id)) ? 'sale' : 'use', ref: bill.number, by: String(by || ''), date: bill.date }); n += 1;
  }
  return n;
}
// A voided bill puts back what it used.
async function restoreForBill(M, tid, bill, by, today) {
  const moves = await M.StockMove.find({ tenantId: tid, ref: bill.number, reason: { $in: ['use', 'sale'] } }).limit(200).lean(); let n = 0;
  for (const m of moves) {
    const p = await M.Product.findOneAndUpdate({ _id: m.productId, tenantId: tid }, { $inc: { stock: -m.qty } }, { new: true }); if (!p) continue;
    await M.StockMove.create({ tenantId: tid, productId: m.productId, qty: -m.qty, reason: 'void-restore', ref: bill.number, by: String(by || ''), date: today }); n += 1;
  }
  return n;
}
module.exports = { consumeForBill, restoreForBill };
