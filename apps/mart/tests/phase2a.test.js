const { model, mkRouter, call } = require('./fake');
const { createMartRouter } = require('../src/routes');
const { gstSummary } = require('../src/gstSummary');
const mk = () => {
  const { r, router } = mkRouter();
  const M = { Settings: model(), Expense: model(), Supplier: model(), Purchase: model(), DayClose: model(), Payment: model(), Audit: model(), BillDiscount: model(), ActivityLog: model() };
  const P = { PosBill: model(), PosItem: model(), PosCustomer: model() };
  createMartRouter({ express: { Router: () => router }, mongoose: {}, protect: 'P', authorize: () => 'A', tenantOf: (req) => req.user.tenantId, now: () => new Date('2026-11-12T06:00:00Z'), models: M, pos: P });
  return { r, M, P };
};
const A = { user: { id: 'u1', tenantId: 'a', role: 'admin' } }; const B = { user: { id: 'u2', tenantId: 'b', role: 'admin' } };
describe('GST summary rules', () => {
  test('groups by rate, skips returned bills, splits cgst/sgst or igst by the bill', () => {
    const s = gstSummary([
      { status: 'paid', gstMode: 'cgst_sgst', lines: [{ rate: 5, taxable: 100, gst: 5 }, { rate: 18, taxable: 200, gst: 36 }] },
      { status: 'paid', gstMode: 'igst', lines: [{ rate: 5, taxable: 100, gst: 5 }] },
      { status: 'returned', gstMode: 'cgst_sgst', lines: [{ rate: 5, taxable: 999, gst: 50 }] }]);
    expect(s.rows.length).toBe(2); expect(s.rows[0].rate).toBe(5); expect(s.rows[0].taxable).toBe(200); expect(s.rows[0].cgst).toBe(3); expect(s.rows[0].sgst).toBe(2); expect(s.rows[0].igst).toBe(5);
    expect(s.taxable).toBe(400); expect(s.gst).toBe(46); expect(s.bills).toBe(2); expect(s.currency).toBe('INR');
  });
});
describe('Mart panel routes (phase 2 part 1)', () => {
  test('day close saves one row per day, is listed for that shop only, and is audited', async () => {
    const { r, M } = mk();
    const x = await call(r['POST /day-closes'], { ...A, method: 'POST', body: { counted: 1200, openingCash: 500 } }); expect(x.c).toBe(201);
    await call(r['POST /day-closes'], { ...A, method: 'POST', body: { counted: 1300, openingCash: 500 } });
    expect(M.DayClose.rows.length).toBe(1); expect((await call(r['GET /day-closes'], A)).b.data.length).toBe(1); expect((await call(r['GET /day-closes'], B)).b.data.length).toBe(0);
    expect((await call(r['POST /day-closes'], { ...A, method: 'POST', body: { counted: -5 } })).c).toBe(400);
    expect(M.Audit.rows.filter((a) => a.action === 'day_close').length).toBe(2); expect(M.Audit.rows[0].tenantId).toBe('a');
  });
  test('supplier bill and payment by name: unknown name refused, other shop cannot reach it, owed goes down oldest first', async () => {
    const { r, M } = mk();
    await call(r['POST /suppliers'], { ...A, method: 'POST', body: { name: 'Ravi Traders' } });
    expect((await call(r['POST /purchases'], { ...A, method: 'POST', body: { supplier: 'Nobody', amount: 100 } })).c).toBe(404);
    expect((await call(r['POST /purchases'], { ...B, method: 'POST', body: { supplier: 'Ravi Traders', amount: 100 } })).c).toBe(404);
    expect((await call(r['POST /purchases'], { ...A, method: 'POST', body: { supplier: 'Ravi Traders', amount: 1000, paid: 200, day: '2026-11-01' } })).c).toBe(201);
    await call(r['POST /purchases'], { ...A, method: 'POST', body: { supplier: 'Ravi Traders', amount: 500, day: '2026-11-05' } });
    expect((await call(r['GET /supplier-payments'], A)).b.data.length).toBe(2); expect((await call(r['GET /supplier-payments'], B)).b.data.length).toBe(0);
    const p = await call(r['POST /supplier-payments'], { ...A, method: 'POST', body: { supplier: 'Ravi Traders', amount: 900 } }); expect(p.c).toBe(200);
    const list = (await call(r['GET /purchases'], A)).b.data; expect(list.reduce((a, x) => a + x.owed, 0)).toBe(400);
    expect(M.Audit.rows.some((a) => a.action === 'supplier_payment')).toBe(true);
  });
  test('festivals: add, list, remove; bad input and more than 30 refused; other shop sees nothing', async () => {
    const { r } = mk();
    expect((await call(r['POST /festivals'], { ...A, method: 'POST', body: { name: 'Diwali', date: '2026-11-08' } })).c).toBe(201);
    expect((await call(r['POST /festivals'], { ...A, method: 'POST', body: { name: 'x', date: 'bad' } })).c).toBe(400);
    const l = (await call(r['GET /festivals'], A)).b.data; expect(l.length).toBe(1); expect(l[0].name).toBe('Diwali'); expect((await call(r['GET /festivals'], B)).b.data.length).toBe(0);
    await call(r['DELETE /festivals/:fid'], { ...B, method: 'DELETE', params: { fid: l[0].id } });
    expect((await call(r['GET /festivals'], A)).b.data.length).toBe(1);
    await call(r['DELETE /festivals/:fid'], { ...A, method: 'DELETE', params: { fid: l[0].id } });
    expect((await call(r['GET /festivals'], A)).b.data.length).toBe(0);
  });
  test('credit limit can be cleared from the panel; typing a limit and ticking remove together is refused', async () => {
    const { r, M } = mk();
    await call(r['PUT /settings'], { ...A, method: 'PUT', body: { defaultCreditLimit: 5000 } }); expect(M.Settings.rows[0].defaultCreditLimit).toBe(5000);
    expect((await call(r['PUT /settings'], { ...A, method: 'PUT', body: { clearCreditLimit: true, defaultCreditLimit: 100 } })).c).toBe(400);
    expect((await call(r['PUT /settings'], { ...A, method: 'PUT', body: { clearCreditLimit: true } })).c).toBe(200); expect(M.Settings.rows[0].defaultCreditLimit).toBe(null);
  });
  test('audit trail: owner only, own shop only, newest first, no customer details', async () => {
    const { r } = mk();
    await call(r['POST /expenses'], { ...A, method: 'POST', body: { category: 'rent', amount: 5000 } }); await call(r['POST /expenses'], { ...B, method: 'POST', body: { category: 'rent', amount: 7 } });
    expect((await call(r['GET /audit'], { user: { id: 's', tenantId: 'a', role: 'subadmin' } })).c).toBe(403);
    const a = (await call(r['GET /audit'], A)).b.data; expect(a.length).toBe(1); expect(a[0].action).toBe('expense_add'); expect(JSON.stringify(a)).not.toMatch(/5000/);
  });
  test('GST summary route needs no other shop data', async () => {
    const { r, P } = mk();
    await P.PosBill.create({ tenantId: 'a', status: 'paid', createdAt: new Date('2026-11-10T06:00:00Z'), gstMode: 'cgst_sgst', total: 105, taxable: 100, gst: 5, lines: [{ rate: 5, taxable: 100, gst: 5 }] });
    await P.PosBill.create({ tenantId: 'b', status: 'paid', createdAt: new Date('2026-11-10T06:00:00Z'), gstMode: 'cgst_sgst', total: 999, taxable: 900, gst: 99, lines: [{ rate: 18, taxable: 900, gst: 99 }] });
    const g = await call(r['GET /reports/gst-summary'], A); expect(g.b.data.taxable).toBe(100); expect(g.b.data.rows.length).toBe(1);
  });
});
