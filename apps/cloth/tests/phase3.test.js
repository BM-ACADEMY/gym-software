const { model, mkRouter, call } = require('./fake');
const { createClothRouter } = require('../src/routes'); const { createCatalogueRouter } = require('../src/catalogueRoutes');
const mk = () => {
  const { r, router } = mkRouter();
  const M = { Settings: model(), Variant: model(), StockMove: model(), Alteration: model(), CustomerInfo: model(), PosCustomer: model(), Expense: model(), DayClose: model(), SupplierBill: model(), Staff: model(), Attendance: model(), BillDiscount: model(), Audit: model(), Tenant: model(), GodownStock: model(), UpiLink: model() };
  createClothRouter({ express: { Router: () => router }, M, protect: 'P', authorize: () => 'A', tenantOf: (req) => req.user.tenantId, now: () => new Date('2026-11-12T06:00:00Z') });
  return { r, M };
};
const A = { user: { id: 'u1', tenantId: 'a', role: 'admin' } }; const B = { user: { id: 'u2', tenantId: 'b', role: 'admin' } }; const S = { user: { id: 'u3', tenantId: 'a', role: 'subadmin' } };
describe('Cloth phase 3 routes (CLO-13)', () => {
  test('settings: GST mode default none, owner-only changes, UPI id checked', async () => {
    const { r } = mk(); const P = (b, x = A) => ({ ...x, method: 'PUT', body: b });
    const g = await call(r['GET /settings'], A); expect(g.b.data.gstMode).toBe('none'); expect(g.b.data.gstModeNote).toMatch(/CA/);
    expect((await call(r['PUT /settings'], P({ gstMode: 'inclusive' }))).b.data.gstMode).toBe('inclusive');
    expect((await call(r['PUT /settings'], P({ gstMode: 'weird' }))).c).toBe(400);
    expect((await call(r['PUT /settings'], P({ gstMode: 'exclusive' }, S))).c).toBe(403);
    expect((await call(r['PUT /settings'], P({ upiId: 'bad' }))).c).toBe(400);
    expect((await call(r['PUT /settings'], P({ upiId: 'shop@okbank' }))).b.data.upiId).toBe('shop@okbank');
    expect((await call(r['GET /settings'], B)).b.data.gstMode).toBe('none');
  });
  test('catalogue: owner switch, only this shop, public page shows only public in-stock items', async () => {
    const { r, M } = mk(); await M.Tenant.create({ _id: 'a', shopName: 'Shop A' });
    const v = await M.Variant.create({ tenantId: 'a', style: 'Kurta', size: 'M', colour: 'Blue', mrp: 899, qty: 3, isActive: true });
    const other = await M.Variant.create({ tenantId: 'b', style: 'Other', size: 'M', colour: 'Blue', mrp: 5, qty: 3, isActive: true });
    expect((await call(r['PUT /variants/:id/public'], { ...S, params: { id: String(v._id) }, method: 'PUT', body: { isPublic: true } })).c).toBe(403);
    expect((await call(r['PUT /variants/:id/public'], { ...B, params: { id: String(v._id) }, method: 'PUT', body: { isPublic: true } })).c).toBe(404);
    expect((await call(r['PUT /variants/:id/public'], { ...A, params: { id: String(v._id) }, method: 'PUT', body: { isPublic: 'yes' } })).c).toBe(400);
    expect((await call(r['PUT /variants/:id/public'], { ...A, params: { id: String(v._id) }, method: 'PUT', body: { isPublic: true } })).b.data.isPublic).toBe(true);
    await call(r['PUT /variants/:id/public'], { ...B, params: { id: String(other._id) }, method: 'PUT', body: { isPublic: true } });
    const l = await call(r['POST /catalogue/link'], { ...A, method: 'POST' }); expect(l.b.data.token.length).toBe(48);
    expect((await call(r['POST /catalogue/link'], { ...S, method: 'POST' })).c).toBe(403);
    const { r: pr, router } = mkRouter(); createCatalogueRouter({ express: { Router: () => router }, M, limit: () => true });
    const page = await call(pr['GET /:token'], { params: { token: l.b.data.token }, query: { format: 'json' }, user: undefined, ip: '1' });
    expect(page.c).toBe(200); expect(page.b.data.items.map((i) => i.style)).toEqual(['Kurta']); expect(page.b.data.items[0].price).toBe(null); expect(page.b.data.shop).toBe('Shop A');
    expect((await call(pr['GET /:token'], { params: { token: 'f'.repeat(48) }, query: {}, ip: '1' })).c).toBe(404);
    expect((await call(pr['GET /:token'], { params: { token: 'nope' }, query: {}, ip: '1' })).c).toBe(404);
    await call(r['POST /catalogue/off'], { ...A, method: 'POST' });
    expect((await call(pr['GET /:token'], { params: { token: l.b.data.token }, query: {}, ip: '1' })).c).toBe(404);
  });
  test('godown transfer: moves stock both ways, never below zero, other shop cannot touch it', async () => {
    const { r, M } = mk(); const v = await M.Variant.create({ tenantId: 'a', style: 'Kurta', size: 'M', colour: 'Blue', mrp: 899, qty: 10, isActive: true }); const id = String(v._id);
    const T = (b, x = A) => ({ ...x, method: 'POST', body: { variantId: id, ...b } });
    expect((await call(r['POST /godown/transfer'], T({ from: 'shop', to: 'Godown 1', qty: 4 }))).b.data.shopDelta).toBe(-4);
    expect(M.Variant.rows[0].qty).toBe(6); expect(M.GodownStock.rows[0].qty).toBe(4);
    expect((await call(r['POST /godown/transfer'], T({ from: 'shop', to: 'Godown 1', qty: 7 }))).c).toBe(400);
    expect((await call(r['POST /godown/transfer'], T({ from: 'Godown 1', to: 'shop', qty: 5 }))).c).toBe(400);
    expect((await call(r['POST /godown/transfer'], T({ from: 'Godown 1', to: 'shop', qty: 3 }))).b.data.shopDelta).toBe(3);
    expect(M.Variant.rows[0].qty).toBe(9); expect(M.GodownStock.rows[0].qty).toBe(1); expect(M.StockMove.rows.length).toBe(2);
    expect((await call(r['POST /godown/transfer'], T({ from: 'shop', to: 'G', qty: 1 }, B))).c).toBe(404);
    const l = await call(r['GET /godown'], A); expect(l.b.data.length).toBe(1); expect(l.b.data[0].qty).toBe(1);
    expect((await call(r['GET /godown'], B)).b.data.length).toBe(0);
  });
  test('shifts calendar: this shop only, bad month refused', async () => {
    const { r, M } = mk(); const s = await M.Staff.create({ tenantId: 'a', name: 'Asha', shift: { start: 600, end: 1080, days: [1, 2, 3, 4, 5, 6] }, isActive: true }); await M.Staff.create({ tenantId: 'b', name: 'Other', isActive: true });
    await M.Attendance.create({ tenantId: 'a', staffId: String(s._id), date: '2026-11-02', status: 'present' });
    const c = await call(r['GET /shifts/calendar'], { ...A, query: { month: '2026-11' } }); expect(c.b.data.people.length).toBe(1); expect(c.b.data.days[1].people[0].marked).toBe('present');
    expect((await call(r['GET /shifts/calendar'], { ...A, query: { month: '2026-13' } })).c).toBe(400);
    expect((await call(r['GET /shifts/calendar'], { ...B, query: { month: '2026-11' } })).b.data.people[0].name).toBe('Other');
  });
  test('item import: preview saves nothing, confirm saves good rows only, owner only, per shop', async () => {
    const { r, M } = mk(); await M.Variant.create({ tenantId: 'b', style: 'Kurta', size: 'M', colour: 'Blue', key: 'KURTA/M/BLUE', barcode: 'KUR-1', mrp: 1, qty: 0, isActive: true });
    const csv = 'style,size,colour,mrp,qty,barcode\nKurta,M,Blue,899,3,KUR-1\nShirt,S,White,-5,,\n"Silk, plain",L,Red,1500,2,\n';
    const P = (x = A) => ({ ...x, method: 'POST', body: { csv } });
    const pv = await call(r['POST /items/import/preview'], P()); expect(pv.b.data.ok).toBe(2); expect(pv.b.data.errorCount).toBe(1); expect(M.Variant.rows.length).toBe(1);
    expect((await call(r['POST /items/import/preview'], P(S))).c).toBe(403); expect((await call(r['POST /items/import/preview'], { ...A, method: 'POST', body: {} })).c).toBe(400);
    expect((await call(r['POST /items/import/preview'], { ...A, method: 'POST', body: { csv: 'a,b\n1,2' } })).c).toBe(400);
    const cf = await call(r['POST /items/import/confirm'], P()); expect(cf.b.data).toEqual({ added: 2, skipped: 1 });
    expect(M.Variant.rows.filter((v) => v.tenantId === 'a').length).toBe(2); expect(M.StockMove.rows.length).toBe(2);
    const again = await call(r['POST /items/import/confirm'], P()); expect(again.b.data.added).toBe(0);
  });
  test('UPI links: need UPI id, whole rupees, owner marks paid, per shop', async () => {
    const { r, M } = mk(); await M.Tenant.create({ _id: 'a', shopName: 'Shop A' }); const P = (b, x = A) => ({ ...x, method: 'POST', body: b });
    expect((await call(r['POST /upi-links'], P({ amount: 100 }))).c).toBe(400);
    await call(r['PUT /settings'], { ...A, method: 'PUT', body: { upiId: 'shop@okbank' } });
    expect((await call(r['POST /upi-links'], P({ amount: 1.5 }))).c).toBe(400);
    const m = await call(r['POST /upi-links'], P({ amount: 1500, note: 'Order 12' })); expect(m.b.data.url).toMatch(/^upi:\/\/pay\?pa=shop%40okbank/); expect(m.b.data.status).toBe('pending');
    expect((await call(r['POST /upi-links/:id/paid'], { ...S, method: 'POST', params: { id: m.b.data.id } })).c).toBe(403);
    expect((await call(r['POST /upi-links/:id/paid'], { ...B, method: 'POST', params: { id: m.b.data.id } })).c).toBe(404);
    expect((await call(r['POST /upi-links/:id/paid'], { ...A, method: 'POST', params: { id: m.b.data.id } })).b.data.status).toBe('paid');
    expect((await call(r['POST /upi-links/:id/paid'], { ...A, method: 'POST', params: { id: m.b.data.id } })).c).toBe(404);
    expect((await call(r['GET /upi-links'], A)).b.data.length).toBe(1); expect((await call(r['GET /upi-links'], B)).b.data.length).toBe(0);
  });
});
