const DR = require('../src/dataRights'); const { createWashRouter } = require('../src/routes'); const { makeFakeModels } = require('./fakeModels');
const T1 = 'aaaaaaaaaaaaaaaaaaaaaaa1', T2 = 'aaaaaaaaaaaaaaaaaaaaaaa2';
function owner() {
  const h = {}; const router = { use: () => {}, get: (p, ...f) => (h['GET ' + p] = f), post: (p, ...f) => (h['POST ' + p] = f), put: (p, ...f) => (h['PUT ' + p] = f) };
  const M = makeFakeModels(); createWashRouter({ express: { Router: () => router }, models: M, protect: 'P', authorize: () => 'A', tenantOf: (req) => req.user.tenantId, planOf: () => 'growth', now: () => new Date('2026-11-12T08:00:00Z') });
  const call = async (key, tenant, { body = {}, params = {}, role = 'admin' } = {}) => { const o = { headers: {} }; const req = { user: { id: 'u', tenantId: tenant, role }, body, query: {}, params }; const res = { set: (k, v) => { o.headers[k] = v; }, send: (b) => { o.text = b; if (!o.c) o.c = 200; }, status(c) { o.c = c; return this; }, json(b) { o.b = b; if (!o.c) o.c = 200; } }; const chain = h[key]; for (let i = 0; i < chain.length; i++) { let went = false; await chain[i](req, res, () => { went = true; }); if (!went) break; } return o; };
  return { call, M };
}
describe('data rights', () => {
  test('delete request needs the exact words; export strips passwords and shapes every list', () => {
    expect(DR.checkDeleteRequest({ confirm: 'delete my data' }).error).toMatch(/DELETE MY DATA/); expect(DR.checkDeleteRequest({ confirm: DR.CONFIRM_TEXT }).ok).toBe(true); expect(DR.checkDeleteRequest(null).error).toMatch(/words/);
    const x = DR.shapeExport({ tenant: { businessName: 'Shine' }, data: { vehicles: [{ plate: 'A', passwordHash: 'secret', __v: 1 }] }, now: new Date('2026-11-12T00:00:00Z') });
    expect(x.vehicles[0]).toEqual({ plate: 'A' }); expect(x.jobs).toEqual([]); expect(x.product).toBe('wash'); expect(JSON.stringify(x).includes('secret')).toBe(false);
  });
  test('export is owner only, holds only this business, and is audited', async () => {
    const O = owner(); await O.M.Tenant.create({ _id: T1, businessName: 'Shine' });
    await O.M.Vehicle.create({ tenantId: T1, plate: 'TN09AB1234', klass: 'sedan', ownerName: 'Ravi' }); await O.M.Vehicle.create({ tenantId: T2, plate: 'TN10CD5678', klass: 'sedan', ownerName: 'Other' });
    expect((await O.call('GET /export', T1, { role: 'subadmin' })).c).toBe(403);
    const r = await O.call('GET /export', T1); const j = JSON.parse(r.text);
    expect(j.vehicles.length).toBe(1); expect(j.vehicles[0].plate).toBe('TN09AB1234'); expect(r.text.includes('Other')).toBe(false); expect(r.headers['Content-Disposition']).toMatch(/wash-data-2026-11-12\.json/);
    expect(O.M.Audit.rows.some((a) => a.action === 'data.export')).toBe(true);
  });
  test('anonymise removes name and phone (and waiting booking details) but keeps the plate and the money; owner only; own business only', async () => {
    const O = owner(); await O.M.Vehicle.create({ tenantId: T1, plate: 'TN09AB1234', klass: 'sedan', ownerName: 'Ravi', ownerPhone: '9876543210' });
    await O.M.Job.create({ tenantId: T1, number: 1, plate: 'TN09AB1234', day: '2026-11-12', state: 'delivered', total: 400 });
    await O.M.Booking.create({ tenantId: T1, plate: 'TN09AB1234', status: 'new', name: 'Ravi', phone: '9876543210', day: '2026-11-13', slot: '10:00', note: 'gate 2' });
    expect((await O.call('POST /vehicles/:plate/anonymise', T1, { params: { plate: 'TN09AB1234' }, role: 'subadmin' })).c).toBe(403);
    expect((await O.call('POST /vehicles/:plate/anonymise', T2, { params: { plate: 'TN09AB1234' } })).c).toBe(404);
    expect((await O.call('POST /vehicles/:plate/anonymise', T1, { params: { plate: 'ZZZ' } })).c).toBe(400);
    expect((await O.call('POST /vehicles/:plate/anonymise', T1, { params: { plate: 'TN09AB1234' } })).c).toBe(200);
    const v = O.M.Vehicle.rows[0]; expect(v.ownerName).toBe(''); expect(v.ownerPhone).toBe(undefined); expect(v.doNotContact).toBe(true); expect(O.M.Job.rows[0].total).toBe(400);
    expect(O.M.Booking.rows[0].phone).toBe('0000000000'); expect(O.M.Booking.rows[0].name).toBe('Removed on request');
  });
  test('delete request: exact words, owner only, switches the booking link off, can be cancelled, all audited', async () => {
    const O = owner(); await O.M.Tenant.create({ _id: T1, businessName: 'Shine', bookingToken: 'a'.repeat(48) });
    expect((await O.call('POST /account/delete-request', T1, { body: { confirm: 'yes' } })).c).toBe(400);
    expect((await O.call('POST /account/delete-request', T1, { body: { confirm: DR.CONFIRM_TEXT }, role: 'subadmin' })).c).toBe(403);
    const r = await O.call('POST /account/delete-request', T1, { body: { confirm: DR.CONFIRM_TEXT } }); expect(r.c).toBe(202); expect(r.b.message).toMatch(/30 days/);
    expect(O.M.Tenant.rows[0].deleteRequestedAt instanceof Date).toBe(true); expect(O.M.Tenant.rows[0].bookingToken).toBe(undefined);
    expect((await O.call('POST /account/delete-request/cancel', T1)).c).toBe(200); expect(O.M.Tenant.rows[0].deleteRequestedAt).toBe(undefined);
    expect(O.M.Audit.rows.map((a) => a.action)).toEqual(['account.delete_requested', 'account.delete_cancelled']);
  });
});
