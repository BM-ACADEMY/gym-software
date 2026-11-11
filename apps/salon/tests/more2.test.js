const { call } = require('./fake'); const { setupMore, ownerOf, staffOf, openDay } = require('./helpers'); const PV = require('../src/privacy');
describe('Phase 2 (2): export and delete on request', () => {
  test('pure: anonymise patch removes identity and keeps the phone unique; confirm word needed', () => {
    const p = PV.anonymisePatch('abc'); expect(p.name).toBe('Deleted customer'); expect(p.phone).toBe('deleted-abc'); expect(p.consent).toBe(null); expect(p.doNotContact).toBe(true);
    expect(PV.confirmed({ confirm: 'DELETE' })).toBe(true); expect(PV.confirmed({ confirm: 'delete' })).toBe(false); expect(PV.confirmed(undefined)).toBe(false);
    const e = PV.customerExport({ customer: { name: 'A', phone: '1' }, appointments: [], bills: [] }); expect(e.kind).toBe('customer-export'); expect(e.clinicalNotesIncluded).toBe(false);
  });
  test('export is the owner only and shows only this customer; other business gets 404', async () => {
    const s = await setupMore(); const M = s.M;
    const c = await M.Customer.create({ tenantId: s.A.id, name: 'Ravi', phone: '9840012210', note: 'likes short' });
    await M.Bill.create({ tenantId: s.A.id, number: 'B1', date: '2026-11-01', customerId: c._id, total: 500, status: 'paid' }); await M.Bill.create({ tenantId: s.A.id, number: 'B2', date: '2026-11-01', total: 700, status: 'paid' });
    const r = await call(s.more, 'GET', '/privacy/customers/:id/export', { ...ownerOf(s.A.id), params: { id: String(c._id) } });
    expect(r.code).toBe(200); expect(r.body.data.customer.name).toBe('Ravi'); expect(r.body.data.bills.length).toBe(1);
    expect((await call(s.more, 'GET', '/privacy/customers/:id/export', { ...ownerOf(s.Bt.id), params: { id: String(c._id) } })).code).toBe(404);
    expect((await call(s.more, 'GET', '/privacy/customers/:id/export', { ...staffOf(s.A.id, s.A.staffId), params: { id: String(c._id) } })).code).toBe(403);
    expect((await M.Audit.find({ tenantId: s.A.id })).some((a) => a.action === 'privacy.export')).toBe(true);
  });
  test('delete needs the confirm word, anonymises, frees the held slot, keeps bills, is audited, cannot repeat, other business cannot', async () => {
    const s = await setupMore(); const M = s.M; const day = openDay();
    const ap = await call(s.router, 'POST', '/appointments', { ...ownerOf(s.A.id), body: { date: day, start: 600, staffId: s.A.staffId, serviceKey: 'haircut', name: 'Ravi', phone: '9840012210' } });
    const c = await M.Customer.findOne({ tenantId: s.A.id, phone: '9840012210' }); await M.Bill.create({ tenantId: s.A.id, number: 'B1', date: day, customerId: c._id, total: 500, status: 'paid' });
    const go = (who, body) => call(s.more, 'POST', '/privacy/customers/:id/delete', { ...who, params: { id: String(c._id) }, body });
    expect((await go(ownerOf(s.A.id), {})).code).toBe(400); expect((await go(ownerOf(s.Bt.id), { confirm: 'DELETE' })).code).toBe(404); expect((await go(staffOf(s.A.id, s.A.staffId), { confirm: 'DELETE' })).code).toBe(403);
    expect((await go(ownerOf(s.A.id), { confirm: 'DELETE' })).code).toBe(200);
    const after = await M.Customer.findOne({ _id: c._id }); expect(after.name).toBe('Deleted customer'); expect(after.phone).toBe('deleted-' + String(c._id));
    expect((await M.Appointment.findOne({ _id: ap.body.data.id })).status).toBe('cancelled'); expect((await M.Bill.find({ tenantId: s.A.id })).length).toBe(1);
    expect((await go(ownerOf(s.A.id), { confirm: 'DELETE' })).code).toBe(409);
    expect((await M.Audit.find({ tenantId: s.A.id })).some((a) => a.action === 'privacy.delete')).toBe(true);
    // the slot is free for someone else again
    expect((await call(s.router, 'POST', '/appointments', { ...ownerOf(s.A.id), body: { date: day, start: 600, staffId: s.A.staffId, serviceKey: 'haircut', name: 'Other', phone: '9944551872' } })).code).toBe(201);
  });
  test('business export is the owner only, own rows only, no ids or tenant fields', async () => {
    const s = await setupMore(); await s.M.Customer.create({ tenantId: s.A.id, name: 'A1', phone: '9840012210' }); await s.M.Customer.create({ tenantId: s.Bt.id, name: 'B1', phone: '9840012211' });
    const r = await call(s.more, 'GET', '/privacy/export.json', ownerOf(s.A.id)); expect(r.body.data.customers.length).toBe(1); expect(r.body.data.customers[0].tenantId).toBe(undefined); expect(r.body.data.business.businessName).toBe('Alpha');
    expect((await call(s.more, 'GET', '/privacy/export.json', staffOf(s.A.id, s.A.staffId))).code).toBe(403);
  });
});
