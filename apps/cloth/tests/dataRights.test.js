const { model, mkRouter, call } = require('./fake');
const DR = require('../src/dataRights'); const { createClothRouter } = require('../src/routes');
const mk = () => { const { r, router } = mkRouter(); const M = { Settings: model(), Variant: model(), StockMove: model(), Alteration: model(), CustomerInfo: model(), PosCustomer: model(), Expense: model(), DayClose: model(), SupplierBill: model(), Staff: model(), Attendance: model(), BillDiscount: model(), Audit: model(), Tenant: model() };
  createClothRouter({ express: { Router: () => router }, M, protect: 'P', authorize: () => 'A', tenantOf: (req) => req.user.tenantId, now: () => new Date('2026-11-12T06:00:00Z'), billsBetween: async (tid) => (tid === 'a' ? [{ id: 'b1', number: 'CL1', total: 100 }] : []) }); return { r, M }; };
const A = { user: { id: 'u1', tenantId: 'a', role: 'admin' } }; const B = { user: { id: 'u2', tenantId: 'b', role: 'admin' } }; const SUB = { user: { id: 'u3', tenantId: 'a', role: 'subadmin' } };
describe('data export, delete on request, audit (CLO-10)', () => {
  test('export has no secrets and no other shop; cut lists are named', () => {
    const e = DR.shopExport({ tenant: { shopName: 'S', passwordHash: 'x' }, alterations: [{ _id: 'a1', what: 'hem', pickupToken: 'secret', tenantId: 't' }], staff: Array(5001).fill({ name: 'x' }) });
    expect(JSON.stringify(e).includes('secret')).toBe(false); expect(JSON.stringify(e).includes('passwordHash')).toBe(false); expect(e.alterations[0].id).toBe('a1'); expect(e.cut).toEqual(['staff']); expect(e.staff.length).toBe(5000);
  });
  test('export route: owner only, audited, this shop only', async () => {
    const { r, M } = mk(); await M.Variant.create({ tenantId: 'a', style: 'Kurta', size: 'M', colour: 'B', mrp: 1, isActive: true }); await M.Variant.create({ tenantId: 'b', style: 'Secret', size: 'M', colour: 'B', mrp: 1, isActive: true });
    const x = await call(r['GET /export/all.json'], A); expect(x.text.includes('Kurta')).toBe(true); expect(x.text.includes('Secret')).toBe(false); expect(x.text.includes('CL1')).toBe(true);
    expect((await call(r['GET /export/all.json'], SUB)).c).toBe(403); expect(M.Audit.rows.some((a) => a.action === 'export.all')).toBe(true);
  });
  test('delete: owner only, must type DELETE, wipes name and phone, keeps bills, another shop cannot', async () => {
    const { r, M } = mk(); const c = await M.PosCustomer.create({ tenantId: 'a', name: 'Asha', phone: '9000000001', email: 'a@x.in', isActive: true }); const id = String(c._id);
    await M.CustomerInfo.create({ tenantId: 'a', customerId: id, sizes: 'M', occasionOn: '11-15' }); await M.Alteration.create({ tenantId: 'a', customerId: id, customerName: 'Asha', customerPhone: '9000000001', what: 'hem' });
    const P = (b, x = A) => ({ ...x, params: { id }, method: 'POST', body: b });
    expect((await call(r['POST /customers/:id/delete'], P({}))).c).toBe(400); expect((await call(r['POST /customers/:id/delete'], P({ confirm: 'DELETE' }, SUB))).c).toBe(403); expect((await call(r['POST /customers/:id/delete'], P({ confirm: 'DELETE' }, B))).c).toBe(404);
    expect(M.PosCustomer.rows[0].name).toBe('Asha');
    expect((await call(r['POST /customers/:id/delete'], P({ confirm: 'DELETE' }))).b.success).toBe(true);
    expect(M.PosCustomer.rows[0].name).toBe('Removed on request'); expect(M.PosCustomer.rows[0].phone).toBe(undefined); expect(M.PosCustomer.rows[0].isActive).toBe(false);
    expect(M.Alteration.rows[0].customerPhone).toBe(undefined); expect(M.Alteration.rows[0].customerName).toBe('Removed on request'); expect(M.CustomerInfo.rows[0].doNotContact).toBe(true);
    expect(M.Audit.rows.some((a) => a.action === 'customer.anonymise')).toBe(true);
  });
  test('audit list: owner only, this shop only, newest limit respected', async () => {
    const { r, M } = mk(); await M.Audit.create({ tenantId: 'a', action: 'x', text: 'mine' }); await M.Audit.create({ tenantId: 'b', action: 'x', text: 'theirs' });
    const l = await call(r['GET /audit'], { ...A, query: {} }); expect(l.b.data.rows.length).toBe(1); expect(l.b.data.rows[0].text).toBe('mine');
    expect((await call(r['GET /audit'], { ...SUB, query: {} })).c).toBe(403);
  });
});
