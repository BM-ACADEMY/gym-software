const { model, mkRouter, call } = require('./fake');
const Lk = require('../src/leaks'); const { createClothRouter } = require('../src/routes');
const mk = () => { const { r, router } = mkRouter(); const M = { Settings: model(), Variant: model(), StockMove: model(), Alteration: model(), CustomerInfo: model(), PosCustomer: model(), Expense: model(), DayClose: model(), SupplierBill: model(), Staff: model(), Attendance: model(), BillDiscount: model(), Audit: model(), Tenant: model() };
  createClothRouter({ express: { Router: () => router }, M, protect: 'P', authorize: () => 'A', tenantOf: (req) => req.user.tenantId, now: () => new Date('2026-11-12T06:00:00Z') }); return { r, M }; };
const A = { user: { id: 'u1', tenantId: 'a', role: 'admin' } }; const B = { user: { id: 'u2', tenantId: 'b', role: 'admin' } }; const SUB = { user: { id: 'u3', tenantId: 'a', role: 'subadmin' } };
describe('stock count and mismatch alert (CLO-11)', () => {
  test('pure: only real differences, biggest first, metres shown as metres', () => {
    const l = Lk.stockMismatches([{ variantName: 'Kurta M', expected: 10, counted: 8, date: '2026-11-10', unit: 'piece' }, { variantName: 'Cotton', expected: 1000, counted: 1250, date: '2026-11-11', unit: 'metre' }, { variantName: 'Shirt', expected: 5, counted: 5, date: '2026-11-11' }]);
    expect(l.length).toBe(2); expect(l[0].name).toBe('Cotton'); expect(l[0].reason).toMatch(/2.5 m extra/); expect(l[1].reason).toMatch(/2 short/);
  });
  test('count records the difference without changing stock; owner can adjust; staff cannot; fabric in metres; other shop 404', async () => {
    const { r, M } = mk(); const v = await M.Variant.create({ tenantId: 'a', style: 'Kurta', size: 'M', colour: 'B', mrp: 1, qty: 10, isActive: true }); const f = await M.Variant.create({ tenantId: 'a', style: 'Cotton', size: '-', colour: 'W', mrp: 1, qty: 1000, unit: 'metre', isActive: true });
    const P = (id, b, x = A) => ({ ...x, params: { id: String(id) }, method: 'POST', body: b });
    const c = await call(r['POST /variants/:id/count'], P(v._id, { counted: 8 })); expect(c.b.data.difference).toBe(-2); expect(M.Variant.rows[0].qty).toBe(10);
    expect((await call(r['POST /variants/:id/count'], P(v._id, { counted: 1.5 }))).c).toBe(400); expect((await call(r['POST /variants/:id/count'], P(v._id, { counted: 8, adjust: true }, SUB))).c).toBe(403);
    expect((await call(r['POST /variants/:id/count'], P(v._id, { counted: 8 }, B))).c).toBe(404);
    const a = await call(r['POST /variants/:id/count'], P(v._id, { counted: 8, adjust: true })); expect(a.b.data.adjusted).toBe(true); expect(M.Variant.rows[0].qty).toBe(8);
    const fz = await call(r['POST /variants/:id/count'], P(f._id, { counted: 12.5 })); expect(fz.b.data.counted).toBe(1250); expect(fz.b.data.difference).toBe(250);
    expect((await call(r['POST /variants/:id/count'], P(f._id, { counted: 0 }))).b.data.counted).toBe(0);
    const rep = await call(r['GET /reports/stock-mismatch'], { ...A, query: {} }); expect(rep.b.data.items.length).toBe(4); expect(M.Audit.rows.some((x) => x.action === 'stock.count_adjust')).toBe(true);
    expect((await call(r['GET /reports/stock-mismatch'], { ...B, query: {} })).b.data.items.length).toBe(0);
  });
});
