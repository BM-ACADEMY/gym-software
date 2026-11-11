const { model, mkRouter, call } = require('./fake');
const { createClothRouter } = require('../src/routes');
const mk = () => {
  const { r, router } = mkRouter();
  const M = { Settings: model(), Variant: model(), StockMove: model(), Alteration: model(), CustomerInfo: model(), PosCustomer: model(), Expense: model(), DayClose: model(), SupplierBill: model(), Staff: model(), Attendance: model(), BillDiscount: model(), Audit: model() };
  createClothRouter({ express: { Router: () => router }, M, protect: 'P', authorize: () => 'A', tenantOf: (req) => req.user.tenantId, now: () => new Date('2026-11-12T06:00:00Z') });
  return { r, M };
};
const A = { user: { id: 'u1', tenantId: 'a', role: 'admin' } }; const B = { user: { id: 'u2', tenantId: 'b', role: 'admin' } };
describe('barcode and fabric routes (CLO-06)', () => {
  test('labels and scan: this shop only, safe barcode, 404 for another shop', async () => {
    const { r, M } = mk();
    const v = await M.Variant.create({ tenantId: 'a', style: 'Kurta', size: 'M', colour: 'Blue', barcode: 'KUR-1', mrp: 899, qty: 2, isActive: true });
    await M.Variant.create({ tenantId: 'b', style: 'Other', size: 'M', colour: 'Red', barcode: 'OTH-1', mrp: 500, qty: 1, isActive: true });
    const csv = await call(r['GET /labels.csv'], A); expect(csv.text.includes('KUR-1')).toBe(true); expect(csv.text.includes('OTH-1')).toBe(false);
    expect((await call(r['GET /labels.html'], A)).text.includes('Rs 899')).toBe(true);
    const s = await call(r['GET /variants/by-barcode/:code'], { ...A, params: { code: 'KUR-1' } }); expect(s.b.data.line.qty).toBe(1); expect(s.b.data.variant.mrp).toBe(899);
    expect((await call(r['GET /variants/by-barcode/:code'], { ...B, params: { code: 'KUR-1' } })).c).toBe(404);
    expect((await call(r['GET /variants/by-barcode/:code'], { ...A, params: { code: '=bad' } })).c).toBe(400);
  });
  test('fabric: unit only at zero stock, metres in and out as centimetres, never below zero', async () => {
    const { r, M } = mk();
    const f = await M.Variant.create({ tenantId: 'a', style: 'Cotton', size: '-', colour: 'White', mrp: 120, qty: 0, unit: 'piece', isActive: true });
    const id = String(f._id); const P = (b, x = A) => ({ ...x, params: { id }, method: 'POST', body: b });
    expect((await call(r['POST /variants/:id/fabric-stock'], P({ type: 'purchase', metres: 10 }))).c).toBe(404);
    expect((await call(r['POST /variants/:id/unit'], P({ unit: 'metre' }))).b.data.unit).toBe('metre');
    expect((await call(r['POST /variants/:id/unit'], P({ unit: 'furlong' }))).c).toBe(400);
    const a = await call(r['POST /variants/:id/fabric-stock'], P({ type: 'purchase', metres: 10.5 })); expect(a.b.data.stock).toBe('10.5 m');
    expect(M.Variant.rows[0].qty).toBe(1050);
    expect((await call(r['POST /variants/:id/fabric-stock'], P({ type: 'wastage', metres: 0.25 }))).b.data.stock).toBe('10.25 m');
    expect((await call(r['POST /variants/:id/fabric-stock'], P({ type: 'adjust_out', metres: 50 }))).c).toBe(400);
    expect((await call(r['POST /variants/:id/fabric-stock'], P({ type: 'purchase', metres: 1.234 }))).c).toBe(400);
    expect((await call(r['POST /variants/:id/unit'], P({ unit: 'piece' }))).c).toBe(409);
    expect((await call(r['POST /variants/:id/fabric-stock'], P({ type: 'purchase', metres: 1 }, B))).c).toBe(404);
  });
});
describe('set barcode', () => {
  test('safe text only; unknown variant 404', async () => {
    const { r, M } = mk(); const v = await M.Variant.create({ tenantId: 'a', style: 'K', size: 'M', colour: 'B', mrp: 100, qty: 1, isActive: true });
    const P = (b, x = A) => ({ ...x, params: { id: String(v._id) }, method: 'POST', body: b });
    expect((await call(r['POST /variants/:id/barcode'], P({ barcode: 'OK-1' }))).b.data.barcode).toBe('OK-1');
    expect((await call(r['POST /variants/:id/barcode'], P({ barcode: '=1+1' }))).c).toBe(400);
    expect((await call(r['POST /variants/:id/barcode'], P({ barcode: 'OK-2' }, B))).c).toBe(404);
  });
});
describe('bill guard with fabric', () => {
  const guard = require('../src/billGuard');
  const run = async (M, body, user = { tenantId: 'a', id: 'u1' }) => {
    const req = { method: 'POST', path: '/bills', user, body }; let code = 200, out, nexted = false;
    const res = { statusCode: 200, status(c) { code = c; this.statusCode = c; return this; }, json(b) { out = b; } };
    await guard({ M, now: () => new Date('2026-11-12T06:00:00Z') })(req, res, () => { nexted = true; });
    return { req, code, out, nexted, res };
  };
  test('metres are priced per metre and stock is taken in centimetres; short stock refused; pieces unchanged', async () => {
    const { M } = mk();
    const f = await M.Variant.create({ tenantId: 'a', style: 'Cotton', size: '-', colour: 'White', mrp: 120, qty: 1000, unit: 'metre', gstRate: 5, isActive: true });
    const k = await M.Variant.create({ tenantId: 'a', style: 'Kurta', size: 'M', colour: 'Blue', mrp: 899, qty: 2, gstRate: 5, isActive: true });
    const a = await run(M, { lines: [{ variantId: String(f._id), metres: 2.5 }, { variantId: String(k._id), qty: 1 }] });
    expect(a.nexted).toBe(true); expect(a.req.body.lines[0].qty).toBe(2.5); expect(a.req.body.lines[0].unitPrice).toBe(120);
    expect(M.Variant.rows[0].qty).toBe(750); expect(M.Variant.rows[1].qty).toBe(1);
    expect((await run(M, { lines: [{ variantId: String(f._id), metres: 99 }] })).code).toBe(409);
    expect((await run(M, { lines: [{ variantId: String(f._id), metres: 1.234 }] })).code).toBe(400);
    expect((await run(M, { lines: [{ variantId: String(k._id), qty: 1.5 }] })).code).toBe(400);
    expect((await run(M, { lines: [{ variantId: String(f._id), metres: 1 }] }, { tenantId: 'b', id: 'x' })).code).toBe(404);
    expect(M.Variant.rows[0].qty).toBe(750);
  });
});
