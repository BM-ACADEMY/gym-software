const PV = require('../src/privacy'); const { build, TID } = require('./p2fake');
const GID = 'e'.repeat(24); const guest = { _id: GID, name: 'Ravi', phone: '9876543210', birthday: '1990-01-01', visits: ['2026-11-01'] };
const manager = { id: 'u', tenantId: TID, role: 'subadmin', staffRole: 'manager' };
describe('data export, delete and audit (Dine Phase 2)', () => {
  test('export holds only that guest; anonymise removes identity and keeps the phone unique', () => {
    const e = PV.guestExport({ customer: guest, orders: [{ number: 'D-1', grandTotal: 210, status: 'paid', credit: 0, createdAt: '2026-11-01T10:00:00Z' }], loyalty: [{ points: 5, reason: 'earned', date: '2026-11-01' }], credits: [] });
    expect(e.guest.phone).toBe('9876543210'); expect(e.orders[0].total).toBe(210); expect(JSON.stringify(e).indexOf(TID)).toBe(-1);
    const p = PV.anonymisePatch(GID); expect(p.phone).toBe('deleted-' + GID); expect(p.name).toBe('Deleted guest'); expect(p.visits).toEqual([]); expect(p.anonymised).toBe(true);
    expect(PV.owed([{ amount: 300, paid: 100 }, { amount: 50, paid: 50, settled: true }])).toBe(200);
  });
  test('delete needs the owner, the word DELETE, and nothing owed; it anonymises guest, orders, points and credit rows of this venue only', async () => {
    const t = build({ over: { 'Customer.findOne': guest } });
    expect((await t.run('post', '/privacy/guests/:id/delete', { params: { id: GID }, user: manager, body: { confirm: 'DELETE' } })).status).toBe(403);
    expect((await t.run('post', '/privacy/guests/:id/delete', { params: { id: GID }, body: {} })).status).toBe(400);
    const owes = build({ over: { 'Customer.findOne': guest, 'Credit.find': [{ amount: 300, paid: 0, settled: false }] } });
    expect((await owes.run('post', '/privacy/guests/:id/delete', { params: { id: GID }, body: { confirm: 'DELETE' } })).status).toBe(409);
    const ok = await t.run('post', '/privacy/guests/:id/delete', { params: { id: GID }, body: { confirm: 'DELETE' } }); expect(ok.status).toBe(200);
    const ups = t.calls.filter((c) => c.meth === 'updateMany' || c.meth === 'updateOne'); expect(ups.length).toBe(4);
    for (const u of ups) expect(String(u.args[0].tenantId)).toBe(TID);
    expect(t.calls.some((c) => c.model === 'Activity' && c.args[0].action === 'privacy.delete' && c.args[0].ref === GID)).toBe(true);
    const done = build({ over: { 'Customer.findOne': { ...guest, anonymised: true } } });
    expect((await done.run('post', '/privacy/guests/:id/delete', { params: { id: GID }, body: { confirm: 'DELETE' } })).status).toBe(409);
    expect((await t.run('post', '/privacy/guests/:id/delete', { params: { id: 'bad' }, body: { confirm: 'DELETE' } })).status).toBe(404);
  });
  test('exports are owner only, no-store, audited; business export carries no ids or tenant', async () => {
    const t = build({ over: { 'Customer.findOne': guest, 'Customer.find': [guest] } });
    const g = await t.run('get', '/privacy/guests/:id/export', { params: { id: GID } }); expect(g.status).toBe(200); expect(g.h['Cache-Control']).toBe('no-store'); expect(g.b.data.kind).toBe('guest-export');
    expect((await t.run('get', '/privacy/guests/:id/export', { params: { id: GID }, user: manager })).status).toBe(403);
    const b = await t.run('get', '/privacy/export.json'); expect(b.status).toBe(200); expect(JSON.stringify(b.b).indexOf('tenantId')).toBe(-1);
    expect((await t.run('get', '/privacy/export.json', { user: manager })).status).toBe(403);
    expect(t.calls.filter((c) => c.model === 'Activity' && c.meth === 'create').map((c) => c.args[0].action)).toEqual(['privacy.export', 'privacy.export.business']);
  });
  test('audit trail: owner only, own venue, filter is cleaned, rows have no free text', async () => {
    const t = build({ over: { 'Activity.find': [{ _id: 'a', createdAt: '2026-11-12', by: 'u1', action: 'bill.discount', ref: 'D-1 10% by staff', note: 'secret' }] } });
    const r = await t.run('get', '/audit', { query: { action: 'bill.$ne' } }); expect(r.status).toBe(200); expect(r.b.data[0].action).toBe('bill.discount'); expect(JSON.stringify(r.b).indexOf('secret')).toBe(-1);
    const q = t.calls.find((c) => c.model === 'Activity' && c.meth === 'find').args[0]; expect(String(q.tenantId)).toBe(TID); expect(q.action.$regex.indexOf('$')).toBe(-1);
    expect((await t.run('get', '/audit', { user: manager })).status).toBe(403);
  });
});
