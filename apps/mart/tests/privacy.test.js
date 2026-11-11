const { model, mkRouter, call } = require('./fake');
const { createMartRouter } = require('../src/routes');
const PV = require('../src/privacy');
const mk = () => {
  const { r, router } = mkRouter();
  const M = { Settings: model(), Expense: model(), Supplier: model(), Purchase: model(), DayClose: model(), Payment: model(), Audit: model(), DeleteRequest: model(), BillDiscount: model(), ActivityLog: model() };
  const P = { PosBill: model(), PosItem: model(), PosCustomer: model() };
  createMartRouter({ express: { Router: () => router }, mongoose: {}, protect: 'P', authorize: () => 'A', tenantOf: (req) => req.user.tenantId, now: () => new Date('2026-11-12T06:00:00Z'), models: M, pos: P });
  return { r, M, P };
};
const A = { user: { id: 'u1', tenantId: 'a', role: 'admin' } }; const B = { user: { id: 'u2', tenantId: 'b', role: 'admin' } }; const SUB = { user: { id: 's1', tenantId: 'a', role: 'subadmin' } };
describe('privacy rules', () => {
  test('customer export has only that customer and no internal ids; anonymise removes name, phone, email', () => {
    const e = PV.customerExport({ customer: { _id: 'x', name: 'Asha', phone: '9876543210', creditDue: 50, currency: 'INR', tenantId: 'a' }, bills: [{ number: 'M1', total: 100, _id: 'b' }], payments: [{ day: '2026-11-01', amount: 20, method: 'cash', _id: 'p' }] });
    expect(JSON.stringify(e)).not.toMatch(/tenantId|_id/); expect(e.customer.name).toBe('Asha');
    const s = PV.anonymiseSet(new Date()); expect(s.name).toBe('Deleted customer'); expect(s.phone).toBe(null); expect(s.isActive).toBe(false);
    expect(PV.shopDeleteOk('DELETE MY SHOP')).toBe(true); expect(PV.shopDeleteOk('delete my shop')).toBe(false);
  });
});
describe('privacy routes', () => {
  test('only the owner; customer of another shop is 404; delete needs confirm and an acknowledgement when money is owed; anonymised and audited', async () => {
    const { r, M, P } = mk();
    const c = await P.PosCustomer.create({ tenantId: 'a', name: 'Asha', phone: '9876543210', email: 'a@x.in', creditDue: 80 }); const id = String(c._id);
    expect((await call(r['GET /privacy/customers/:id/export'], { ...SUB, params: { id } })).c).toBe(403);
    expect((await call(r['GET /privacy/customers/:id/export'], { ...B, params: { id } })).c).toBe(404);
    const ex = await call(r['GET /privacy/customers/:id/export'], { ...A, params: { id } }); expect(ex.b.data.customer.name).toBe('Asha'); expect(ex.h['Cache-Control']).toBe('no-store');
    expect((await call(r['POST /privacy/customers/:id/delete'], { ...A, method: 'POST', params: { id }, body: {} })).c).toBe(400);
    expect((await call(r['POST /privacy/customers/:id/delete'], { ...A, method: 'POST', params: { id }, body: { confirm: true } })).c).toBe(409);
    expect((await call(r['POST /privacy/customers/:id/delete'], { ...B, method: 'POST', params: { id }, body: { confirm: true, acknowledgeDue: true } })).c).toBe(404);
    expect((await call(r['POST /privacy/customers/:id/delete'], { ...A, method: 'POST', params: { id }, body: { confirm: true, acknowledgeDue: true } })).c).toBe(200);
    const row = P.PosCustomer.rows[0]; expect(row.name).toBe('Deleted customer'); expect(row.phone).toBe(null); expect(row.creditDue).toBe(80);
    expect(M.Audit.rows.map((a) => a.action)).toEqual(['customer_export', 'customer_delete']);
  });
  test('whole-shop export is owner only, no-store, contains only that shop; delete-shop request needs the typed words and is recorded once', async () => {
    const { r, M, P } = mk();
    await P.PosCustomer.create({ tenantId: 'a', name: 'Asha' }); await P.PosCustomer.create({ tenantId: 'b', name: 'Other shop customer' });
    expect((await call(r['GET /privacy/export'], SUB)).c).toBe(403);
    const e = await call(r['GET /privacy/export'], A); expect(e.b.data.customers.length).toBe(1); expect(JSON.stringify(e.b)).not.toMatch(/Other shop/); expect(e.h['Cache-Control']).toBe('no-store');
    expect((await call(r['POST /privacy/delete-shop-request'], { ...A, method: 'POST', body: { confirm: 'yes' } })).c).toBe(400);
    expect((await call(r['POST /privacy/delete-shop-request'], { ...A, method: 'POST', body: { confirm: 'DELETE MY SHOP' } })).c).toBe(201);
    expect((await call(r['POST /privacy/delete-shop-request'], { ...A, method: 'POST', body: { confirm: 'DELETE MY SHOP' } })).b.already).toBe(true);
    expect(M.DeleteRequest.rows.length).toBe(1); expect(M.DeleteRequest.rows[0].tenantId).toBe('a');
  });
});
