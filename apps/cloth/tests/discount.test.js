const { model, call } = require('./fake'); const DP = require('../src/discountPolicy'); const Lk = require('../src/leaks'); const SM = require('../src/summary');
const guard = require('../src/billGuard'); const { createClothRouter } = require('../src/routes'); const { mkRouter } = require('./fake');
const NOW = () => new Date('2026-11-12T06:00:00Z'); const ID = 'a'.repeat(24);
const mk = async (role = 'subadmin', rule) => {
  const M = { Settings: model(), Variant: model(), StockMove: model(), BillDiscount: model(), Audit: model(), PosItem: model() };
  if (rule) await M.Settings.create({ tenantId: 'a', discountRule: rule });
  const v = await M.Variant.create({ tenantId: 'a', style: 'SH', size: 'M', colour: 'Blue', mrp: 1000, gstRate: 5, qty: 5 });
  return { M, v, g: guard({ M, now: NOW }), role };
};
// Runs the variant guard, then a stand-in for the shared bill route that calls the discount hooks the way core-pos does.
const bill = require('../../../packages/core-pos/src/bill');
const run = async ({ M, g, role }, body, { saveStatus = 201 } = {}) => {
  const out = {}; let nexted = false;
  const res = { statusCode: 200, status(c) { this.statusCode = c; return this; }, json(b) { out.b = b; out.c = this.statusCode; return Promise.resolve(); } };
  const req = { method: 'POST', path: '/bills', user: { id: 'u1', tenantId: 'a', role }, body };
  await g(req, res, () => { nexted = true; });
  if (nexted) {
    const hk = guard.discountHooks({ M, now: NOW }); let fields = {}; let refused = null;
    const calc = bill.compute({ lines: req.body.lines.map((l) => ({ name: l.name, unitPrice: l.unitPrice, qty: l.qty, gstRate: l.gstRate || 0 })), billDiscount: req.body.billDiscount });
    try { fields = (await hk.beforeBill({ req, tid: 'a', body: req.body, calc })).fields; } catch (e) { refused = e; }
    if (refused) await res.status(refused.code === 'BILL_FORBIDDEN' ? 403 : 400).json({ success: false, message: refused.message });
    else { const doc = { _id: 'b1', number: 'CL-1', ...fields }; if (saveStatus === 201) await hk.afterBill({ req, tid: 'a', doc, calc }); await res.status(saveStatus).json({ success: saveStatus === 201, data: doc }); }
  }
  out.nexted = nexted; out.body = req.body; return out;
};
describe('D-30 discount rule (Cloth)', () => {
  test('policy: default 10 percent for staff; bad rule falls back; owner never limited', () => {
    expect(DP.normalize(undefined)).toEqual({ staff: 'limit', maxPercent: 10 });
    expect(DP.check({ role: 'staff', discount: 101, subtotal: 1000 }).ok).toBe(false); expect(DP.check({ role: 'admin', discount: 900, subtotal: 1000, rule: { staff: 'owner_only' } }).ok).toBe(true);
  });
  test('staff over the limit is refused with a message and the stock taken for the bill is given back', async () => {
    const s = await mk(); const r = await run(s, { lines: [{ variantId: s.v._id, qty: 1 }], billDiscount: { type: 'amount', value: 300 }, discountReason: 'regular' });
    expect(r.c).toBe(403); expect(r.b.message).toMatch(/up to 10%/); expect(s.M.Variant.rows[0].qty).toBe(5); expect(s.M.BillDiscount.rows.length).toBe(0);
  });
  test('staff within the limit: bill goes on, who and percent saved, audit line written', async () => {
    const s = await mk(); const r = await run(s, { lines: [{ variantId: s.v._id, qty: 1 }], billDiscount: { type: 'amount', value: 100 }, discountReason: 'regular' });
    expect(r.nexted).toBe(true); const d = s.M.BillDiscount.rows[0]; expect(d.by).toBe('staff'); expect(d.percent).toBe(10); expect(d.discount).toBe(100); expect(d.reason).toBe('regular');
    expect(s.M.Audit.rows[0].text).toBe('CL-1 10% by staff');
  });
  test('owner rule from Settings applies: owner_only blocks staff, higher limit allows; the owner gives any discount', async () => {
    const a = await mk('subadmin', { staff: 'owner_only' }); expect((await run(a, { lines: [{ variantId: a.v._id, qty: 1 }], billDiscount: { type: 'amount', value: 1 }, discountReason: 'regular' })).c).toBe(403);
    const b = await mk('subadmin', { staff: 'limit', maxPercent: 30 }); expect((await run(b, { lines: [{ variantId: b.v._id, qty: 1 }], billDiscount: { type: 'amount', value: 300 }, discountReason: 'regular' })).c).toBe(201);
    const c = await mk('admin', { staff: 'owner_only' }); await run(c, { lines: [{ variantId: c.v._id, qty: 1 }], billDiscount: { type: 'amount', value: 500 }, discountReason: 'festival' }); expect(c.M.BillDiscount.rows[0].by).toBe('owner'); expect(c.M.BillDiscount.rows[0].percent).toBe(50);
  });
  test('settings route: only the owner changes the rule; value is normalised; GET shows it', async () => {
    const { r, router } = mkRouter(); const M = { Settings: model(), BillDiscount: model() };
    createClothRouter({ express: { Router: () => router }, M, protect: 'P', authorize: () => 'A', tenantOf: (q) => q.user.tenantId });
    const put = (role, body) => call(r['PUT /settings'], { method: 'PUT', user: { id: 'u', tenantId: 'a', role }, body });
    expect((await put('subadmin', { discountRule: { staff: 'any' } })).c).toBe(403); expect((await put('admin', { discountRule: 'x' })).c).toBe(400);
    expect((await put('admin', { discountRule: { staff: 'limit', maxPercent: 20 } })).b.data.discountRule).toEqual({ staff: 'limit', maxPercent: 20 });
    expect((await call(r['GET /settings'], { user: { id: 'u', tenantId: 'b', role: 'admin' } })).b.data.discountRule).toEqual({ staff: 'limit', maxPercent: 10 });
  });
  test('owner sees staff discounts in the leak list and the daily summary; owner discounts are not listed', () => {
    const rows = [{ date: '2026-11-11', discount: 40, by: 'staff' }, { date: '2026-11-11', discount: 30, by: 'staff' }, { date: '2026-11-11', discount: 90, by: 'owner' }];
    const l = Lk.staffDiscounts(rows); expect(l).toEqual([{ date: '2026-11-11', count: 2, total: 70, currency: 'INR', reason: 'Staff gave 2 discounts worth Rs 70 on 2026-11-11.' }]);
    expect(SM.build({ today: '2026-11-12', staffDiscounts: l }).notes[0]).toMatch(/worth Rs 70/); expect(SM.build({ today: 'x' }).notes).toEqual([]);
  });
});
describe('CLO-05 bills reduce variant stock', () => {
  test('sale takes stock at the shop price (request price ignored), writes a stock move with the bill id', async () => {
    const s = await mk('admin'); const r = await run(s, { lines: [{ variantId: s.v._id, qty: 2, unitPrice: 1 }] });
    const l0 = r.body.lines[0]; expect([l0.name, l0.unitPrice, l0.qty, l0.gstRate]).toEqual(['SH M Blue', 1000, 2, 5]); expect(r.body.lines[0].variantId).toBe(undefined);
    expect(s.M.Variant.rows[0].qty).toBe(3); expect(s.M.Variant.rows[0].lastSoldOn).toBe('2026-11-12'); const m0 = s.M.StockMove.rows[0]; expect([m0.type, m0.qty, m0.billId, m0.date]).toEqual(['sale', 2, 'b1', '2026-11-12']);
  });
  test('short stock is refused and nothing is taken; unsaved bill gives stock back', async () => {
    const s = await mk('admin'); const r = await run(s, { lines: [{ variantId: s.v._id, qty: 9 }] }); expect(r.c).toBe(409); expect(s.M.Variant.rows[0].qty).toBe(5);
    await run(s, { lines: [{ variantId: s.v._id, qty: 2 }] }, { saveStatus: 400 }); expect(s.M.Variant.rows[0].qty).toBe(5); expect(s.M.StockMove.rows.length).toBe(0);
  });
  test('another shop\'s variant, a bad id and a fractional quantity are refused', async () => {
    const s = await mk('admin'); const other = await s.M.Variant.create({ tenantId: 'b', style: 'X', size: 'M', colour: 'R', mrp: 1, qty: 9 });
    expect((await run(s, { lines: [{ variantId: other._id, qty: 1 }] })).c).toBe(404); expect((await run(s, { lines: [{ variantId: 'zz', qty: 1 }] })).c).toBe(400); expect((await run(s, { lines: [{ variantId: s.v._id, qty: 1.5 }] })).c).toBe(400);
  });
  test('other routes and plain lines pass straight through', async () => {
    const s = await mk('admin'); const o = {}; await s.g({ method: 'GET', path: '/items', user: { tenantId: 'a' } }, {}, () => { o.n = true; }); expect(o.n).toBe(true);
    const r = await run(s, { lines: [{ name: 'Belt', unitPrice: 200, qty: 1 }] }); expect(r.nexted).toBe(true); expect(s.M.Variant.rows[0].qty).toBe(5);
  });
});
