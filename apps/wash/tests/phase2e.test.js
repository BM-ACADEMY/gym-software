const VI = require('../src/vehiclesImport'); const { createWashRouter } = require('../src/routes'); const { makeFakeModels } = require('./fakeModels');
const T1 = 'aaaaaaaaaaaaaaaaaaaaaaa1', T2 = 'aaaaaaaaaaaaaaaaaaaaaaa2';
const CSV = 'Vehicle Number,Type,Owner Name,Mobile\nTN09AB1234,Scooter,Ravi,+91 98765 43210\nTN10CD5678,SUV,=HYPERLINK("x"),9876543211\nTN09AB1234,bike,Dup,9876543212\nBAD,bike,x,9876543213\nTN11EF9012,truck,y,9876543214\nTN12GH3456,sedan,z,12345\n';
describe('register import (rules)', () => {
  test('maps headers, normalises plates, classes and phones, strips formula characters, reports each problem row by line', () => {
    const r = VI.parseVehicles(CSV, new Set(['TN10CD5678']));
    expect(r.rows.map((x) => x.plate)).toEqual(['TN09AB1234', 'TN10CD5678']);
    expect(r.rows[0].klass).toBe('bike'); expect(r.rows[0].ownerPhone).toBe('9876543210'); expect(r.rows[1].ownerName).toBe('HYPERLINK(x)'); expect(r.rows[1].exists).toBe(true); expect(r.duplicates).toBe(1);
    expect(r.errors.map((e) => e.line)).toEqual([4, 5, 6, 7]); expect(r.errors[0].message).toMatch(/twice/); expect(r.errors[3].message).toMatch(/phone/);
  });
  test('refuses an empty file, no plate column, one-line file and an oversized file; a long list is cut at the limit and says so', () => {
    expect(VI.parseVehicles('', new Set()).error).toMatch(/CSV/); expect(VI.parseVehicles('Name,Phone\nA,1', new Set()).error).toMatch(/plate column/);
    expect(VI.parseVehicles('Plate,Type', new Set()).error).toMatch(/header row/); expect(VI.parseVehicles('x'.repeat(VI.MAX_CHARS + 1), new Set()).error).toMatch(/too big/);
    let big = 'Plate,Type\n'; for (let i = 0; i < 2100; i++) big += 'TN09AB' + String(1000 + (i % 9000)) + ',bike\n';
    const r = VI.parseVehicles(big.replace(/TN09AB(\d{4})/g, (m, d, off) => 'TN' + (10 + (off % 50)) + 'AB' + String(1000 + (off % 8999))), new Set()); expect(r.truncated).toBe(true); expect(r.total).toBe(2100);
  });
});
function owner() {
  const h = {}; const router = { use: () => {}, get: (p, ...f) => (h['GET ' + p] = f), post: (p, ...f) => (h['POST ' + p] = f), put: (p, ...f) => (h['PUT ' + p] = f) };
  const M = makeFakeModels(); createWashRouter({ express: { Router: () => router }, models: M, protect: 'P', authorize: () => 'A', tenantOf: (req) => req.user.tenantId, planOf: () => 'growth', now: () => new Date('2026-11-12T08:00:00Z') });
  const call = async (key, tenant, { body = {}, role = 'admin' } = {}) => { const o = {}; const req = { user: { id: 'u', tenantId: tenant, role }, body, query: {}, params: {} }; const res = { set: () => {}, status(c) { o.c = c; return this; }, json(b) { o.b = b; if (!o.c) o.c = 200; } }; const chain = h[key]; for (let i = 0; i < chain.length; i++) { let went = false; await chain[i](req, res, () => { went = true; }); if (!went) break; } return o; };
  return { call, M };
}
describe('register import (routes)', () => {
  test('preview saves nothing; commit is owner only, needs the owner to skip bad rows, upserts by plate and stays inside the business', async () => {
    const O = owner(); await O.M.Vehicle.create({ tenantId: T2, plate: 'TN10CD5678', klass: 'sedan', ownerName: 'Other business' });
    const pv = await O.call('POST /vehicles/import/preview', T1, { body: { csv: CSV } });
    expect(pv.c).toBe(200); expect(pv.b.data.ok).toBe(2); expect(pv.b.data.willAdd).toBe(2); expect(pv.b.data.errorCount).toBe(4); expect(O.M.Vehicle.rows.filter((r) => r.tenantId === T1).length).toBe(0);
    expect((await O.call('POST /vehicles/import/commit', T1, { body: { csv: CSV }, role: 'subadmin' })).c).toBe(403);
    expect((await O.call('POST /vehicles/import/commit', T1, { body: { csv: CSV } })).c).toBe(400);
    const done = await O.call('POST /vehicles/import/commit', T1, { body: { csv: CSV, skipErrors: true } });
    expect(done.c).toBe(201); expect(done.b.data).toEqual({ added: 2, updated: 0, skipped: 4 });
    expect(O.M.Vehicle.rows.filter((r) => r.tenantId === T1).length).toBe(2); expect(O.M.Vehicle.rows.find((r) => r.tenantId === T2).ownerName).toBe('Other business');
    const again = await O.call('POST /vehicles/import/commit', T1, { body: { csv: CSV, skipErrors: true } }); expect(again.b.data).toEqual({ added: 0, updated: 2, skipped: 4 });
    expect(O.M.Vehicle.rows.filter((r) => r.tenantId === T1).length).toBe(2); expect(O.M.Audit.rows.filter((r) => r.action === 'vehicles.import').length).toBe(2);
  });
});
