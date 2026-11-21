const { model, mkRouter, call } = require('./fake');
const { createClothRouter } = require('../src/routes');
const mk = (extra = {}) => {
  const { r, router } = mkRouter();
  const M = { Settings: model(), Variant: model(), StockMove: model(), Alteration: model(), CustomerInfo: model(), PosCustomer: model(), Expense: model(), DayClose: model(), SupplierBill: model(), Staff: model(), Attendance: model(), BillDiscount: model() };
  createClothRouter({ express: { Router: () => router }, M, protect: 'P', authorize: () => 'A', tenantOf: (req) => req.user.tenantId, now: () => new Date('2026-11-12T06:00:00Z'), ...extra });
  return { r, M };
};
const A = { user: { id: 'u1', tenantId: 'a' } }; const B = { user: { id: 'u2', tenantId: 'b' } };
describe('Cloth routes', () => {
  test('variant grid: creates rows with GST from bands and the shop only sees its own', async () => {
    const { r } = mk();
    const c = await call(r['POST /variants/grid'], { ...A, method: 'POST', body: { style: 'SH-1', sizes: ['M', 'L'], colours: ['Blue'], mrp: 799, cost: 400 } });
    expect(c.c).toBe(201); expect(c.b.data.added).toBe(2); expect(c.b.data.gstRate).toBe(5); expect(c.b.data.gstNeedsCaCheck).toBe(true);
    const again = await call(r['POST /variants/grid'], { ...A, method: 'POST', body: { style: 'SH-1', sizes: ['M', 'L'], colours: ['Blue'], mrp: 799 } }); expect(again.b.data.added).toBe(0); expect(again.b.data.skipped.length).toBe(2);
    expect((await call(r['GET /variants'], A)).b.data.length).toBe(2); expect((await call(r['GET /variants'], B)).b.data.length).toBe(0);
    expect((await call(r['POST /variants/grid'], { ...A, method: 'POST', body: { style: '', sizes: ['M'], colours: ['B'], mrp: 5 } })).c).toBe(400);
  });
  test('plan cap on variants is enforced with a clear message', async () => {
    const { r } = mk({ planOf: () => 'starter' });
    const sizes = Array.from({ length: 20 }, (_, i) => 's' + i), colours = Array.from({ length: 26 }, (_, i) => 'c' + i);
    const x = await call(r['POST /variants/grid'], { ...A, method: 'POST', body: { style: 'A', sizes: sizes.slice(0, 10), colours: colours.slice(0, 20), mrp: 9 } }); expect(x.c).toBe(201);
    const y = await call(r['POST /variants/grid'], { ...A, method: 'POST', body: { style: 'B', sizes, colours, mrp: 9 } }); expect(y.c).toBe(400);
    const z = await call(r['POST /variants/grid'], { ...A, method: 'POST', body: { style: 'C', sizes: sizes.slice(0, 10), colours: colours.slice(0, 20), mrp: 9 } }); expect(z.c).toBe(201);
    const w = await call(r['POST /variants/grid'], { ...A, method: 'POST', body: { style: 'D', sizes: sizes.slice(0, 10), colours: colours.slice(0, 20), mrp: 9 } }); expect(w.c).toBe(402); expect(w.b.message).toMatch(/500 variants/);
  });
  test('stock move: purchase, sale sets last sold, too much refused, another shop cannot touch it', async () => {
    const { r, M } = mk(); await call(r['POST /variants/grid'], { ...A, method: 'POST', body: { style: 'SH', sizes: ['M'], colours: ['B'], mrp: 500 } }); const id = M.Variant.rows[0]._id;
    expect((await call(r['POST /variants/:id/stock'], { ...A, method: 'POST', params: { id }, body: { type: 'purchase', qty: 10 } })).b.data.qty).toBe(10);
    const s = await call(r['POST /variants/:id/stock'], { ...A, method: 'POST', params: { id }, body: { type: 'sale', qty: 3 } }); expect(s.b.data.qty).toBe(7); expect(s.b.data.lastSoldOn).toBe('2026-11-12');
    expect((await call(r['POST /variants/:id/stock'], { ...A, method: 'POST', params: { id }, body: { type: 'sale', qty: 99 } })).c).toBe(400);
    expect((await call(r['POST /variants/:id/stock'], { ...B, method: 'POST', params: { id }, body: { type: 'sale', qty: 1 } })).c).toBe(404);
    expect((await call(r['POST /variants/:id/stock'], { ...A, method: 'POST', params: { id: 'zz' }, body: { type: 'sale', qty: 1 } })).c).toBe(400);
  });
  test('writes are blocked when the plan is read-only; reads stay open', async () => {
    const { r } = mk({ guardWrite: (req) => (req.method === 'GET' ? null : { status: 402, message: 'Plan ended' }) });
    expect((await call(r['POST /expenses'], { ...A, method: 'POST', body: { date: '2026-11-12', amount: 5 } })).c).toBe(402);
    expect((await call(r['GET /expenses'], A)).c).toBe(200);
  });
  test('alterations: add, flow, bad move, tenant isolation, ready date is today', async () => {
    const { r } = mk(); const c = await call(r['POST /alterations'], { ...A, method: 'POST', body: { what: 'Shorten sleeves', readyOn: '2026-11-15', charge: 150, advance: 50, customerName: 'Ravi' } }); expect(c.c).toBe(201);
    const id = c.b.data._id;
    expect((await call(r['POST /alterations'], { ...A, method: 'POST', body: { what: 'x', readyOn: '2026-11-15', charge: 1 } })).c).toBe(400);
    expect((await call(r['POST /alterations/:id/status'], { ...A, method: 'POST', params: { id }, body: { status: 'delivered' } })).c).toBe(400);
    const rd = await call(r['POST /alterations/:id/status'], { ...A, method: 'POST', params: { id }, body: { status: 'ready' } }); expect(rd.b.data.readyAt).toBe('2026-11-12'); expect(rd.b.notify).toMatch(/ready/);
    expect((await call(r['POST /alterations/:id/status'], { ...B, method: 'POST', params: { id }, body: { status: 'delivered' } })).c).toBe(404);
    expect((await call(r['GET /alterations'], B)).b.data.length).toBe(0); expect((await call(r['GET /alterations'], { ...A, query: { status: 'ready' } })).b.data.length).toBe(1);
  });
  test('settings: validated, per shop, default bands when none saved', async () => {
    const { r } = mk(); expect((await call(r['GET /settings'], A)).b.data.gstBands.needsCaConfirmation).toBe(true);
    expect((await call(r['PUT /settings'], { ...A, method: 'PUT', body: { growthPct: 500 } })).c).toBe(400);
    expect((await call(r['PUT /settings'], { ...A, method: 'PUT', body: { gstBands: { bands: [{ upTo: 100, rate: 7 }] } } })).c).toBe(400);
    expect((await call(r['PUT /settings'], { ...A, method: 'PUT', body: { growthPct: 10, supplierDue: 5000 } })).b.data.growthPct).toBe(10);
    expect((await call(r['GET /settings'], B)).b.data.growthPct).toBe(0);
    expect((await call(r['PUT /settings'], { ...A, method: 'PUT', body: {} })).c).toBe(400);
  });
  test('customer info: occasion, credit date, do-not-contact validated and kept per shop', async () => {
    const { r, M } = mk(); const id = 'c'.repeat(24);
    expect((await call(r['PUT /customers/:id/info'], { ...A, method: 'PUT', params: { id }, body: { occasionOn: '11-15', doNotContact: true } })).c).toBe(200);
    expect((await call(r['PUT /customers/:id/info'], { ...A, method: 'PUT', params: { id }, body: { occasionOn: 'x' } })).c).toBe(400);
    expect((await call(r['PUT /customers/:id/info'], { ...A, method: 'PUT', params: { id }, body: { creditSince: 'bad' } })).c).toBe(400);
    expect(M.CustomerInfo.rows[0].tenantId).toBe('a'); expect(M.CustomerInfo.rows[0].doNotContact).toBe(true);
  });
  test('reports: slow stock, size gaps, festival (needs data), follow-ups, summary with three actions, per shop', async () => {
    const { r, M } = mk({ salesOfDay: async () => ({ total: 12000, bills: 8 }) });
    await M.Variant.create({ tenantId: 'a', style: 'OLD', size: 'M', colour: 'B', key: 'OLD/M/B', mrp: 1000, cost: 600, qty: 10, addedOn: '2026-03-01', lastSoldOn: '2026-06-01' });
    await M.Variant.create({ tenantId: 'a', style: 'SH', size: 'M', colour: 'B', key: 'SH/M/B', mrp: 500, cost: 250, qty: 0, addedOn: '2026-03-01', lastSoldOn: '2026-11-10' });
    await M.Variant.create({ tenantId: 'a', style: 'SH', size: 'L', colour: 'B', key: 'SH/L/B', mrp: 500, cost: 250, qty: 8, addedOn: '2026-03-01' });
    await M.StockMove.create({ tenantId: 'a', variantId: M.Variant.rows[1]._id, type: 'sale', qty: 4, date: '2026-11-05' });
    await M.StockMove.create({ tenantId: 'a', variantId: M.Variant.rows[0]._id, type: 'sale', qty: 7, date: '2025-10-18' });
    await M.Alteration.create({ tenantId: 'a', what: 'Hem', readyOn: '2026-11-09', status: 'received', charge: 100 });
    const slow = (await call(r['GET /reports/slow-stock'], A)).b.data; expect(slow.length).toBe(1); expect(slow[0].style).toBe('OLD'); expect(slow[0].idea.reason).toMatch(/Not sold/); expect((await call(r['GET /reports/slow-stock'], B)).b.data.length).toBe(0);
    const gaps = (await call(r['GET /reports/size-gaps'], A)).b.data; expect(gaps[0].size).toBe('M');
    const fest = await call(r['GET /reports/festival'], { ...A, query: { from: '2025-10-15', to: '2025-10-25' } }); expect(fest.b.data.lastYearUnits).toBe(7);
    expect((await call(r['GET /reports/festival'], { ...B, query: { from: '2025-10-15', to: '2025-10-25' } })).b.message).toMatch(/Import/);
    expect((await call(r['GET /reports/festival'], { ...A, query: { from: 'x', to: 'y' } })).c).toBe(400);
    expect((await call(r['GET /reports/followups'], A)).c).toBe(200);
    const sm = (await call(r['GET /summary'], A)).b.data; expect(sm.salesYesterday).toBe(12000); expect(sm.actions.length).toBe(3); expect(sm.mode).toBe('suggest'); expect(sm.actions[0].key).toBe('alt_overdue');
    expect((await call(r['GET /summary'], B)).b.data.actions).toEqual([]);
  });
});
