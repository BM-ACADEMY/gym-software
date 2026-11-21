const { createMarketingRouter } = require('../src/marketingRoutes');
function setup() {
  const items = []; const cal = [];
  const store = { list: async () => items.slice(), get: async (id) => items.find((i) => i.id === id) || null, insert: async (i) => { const x = { id: 'id' + (items.length + 100000), ...i }; items.push(x); return x; },
    update: async (id, p) => Object.assign(items.find((i) => i.id === id), p), keys: async () => items.map((i) => i.key).filter(Boolean), calendar: async () => cal, setCalendar: async (e) => { cal.length = 0; cal.push(...e); } };
  const routes = {}; const router = { use() {}, get: (p, h) => (routes['GET ' + p] = h), post: (p, h) => (routes['POST ' + p] = h), delete: (p, h) => (routes['DELETE ' + p] = h), put: (p, h) => (routes['PUT ' + p] = h) };
  const audits = [];
  createMarketingRouter({ express: { Router: () => router }, protect: 1, authorize: () => 2, store, audit: (a) => audits.push(a), now: () => new Date('2026-11-02T04:30:00Z'),
    getFacts: async () => ({ products: [{ product: 'hire', state: 'ok', businesses: { expired: 2, signups7d: 0 }, endingSoon: [{ kind: 'trial', daysLeft: 1 }] }], totals: {} }) });
  const call = async (key, role, { params = {}, body = {}, query = {} } = {}) => { let out = { c: 200 }; const res = { status(c) { out.c = c; return this; }, json(b) { out.b = b; } }; await routes[key]({ user: { id: 'u1', role }, params, body, query }, res); return out; };
  return { call, items, audits };
}
describe('marketing routes', () => {
  test('owner refresh adds suggestions once; DM team cannot refresh', async () => {
    const s = setup(); expect((await s.call('POST /refresh', 'marketing')).c).toBe(403);
    const a = await s.call('POST /refresh', 'root_admin'); expect(a.b.added).toBe(3); expect((await s.call('POST /refresh', 'root_admin')).b.added).toBe(0); expect(s.audits.length).toBe(2);
  });
  test('DM team can mark done only after owner approves; cannot approve or skip', async () => {
    const s = setup(); await s.call('POST /refresh', 'root_admin'); const id = s.items[0].id;
    expect((await s.call('POST /items/:id/:action', 'marketing', { params: { id, action: 'approve' } })).c).toBe(403);
    expect((await s.call('POST /items/:id/:action', 'marketing', { params: { id, action: 'done' } })).c).toBe(400); // still "suggested"
    expect((await s.call('POST /items/:id/:action', 'root_admin', { params: { id, action: 'approve' } })).b.data.status).toBe('approved');
    expect((await s.call('POST /items/:id/:action', 'marketing', { params: { id, action: 'done' } })).b.data.status).toBe('done');
  });
  test('bad id or action and missing item', async () => {
    const s = setup(); expect((await s.call('POST /items/:id/:action', 'root_admin', { params: { id: 'abcdef', action: 'explode' } })).c).toBe(400);
    expect((await s.call('POST /items/:id/:action', 'root_admin', { params: { id: 'zzzzzz', action: 'approve' } })).c).toBe(404);
  });
  test('add item as DM team is forced to dm_team owner; bad item refused; today list works', async () => {
    const s = setup(); const r = await s.call('POST /items', 'marketing', { body: { title: 'Draft Hire reel script', reason: 'launch', owner: 'sales' } });
    expect(r.c).toBe(201); expect(r.b.data.owner).toBe('dm_team'); expect((await s.call('POST /items', 'marketing', { body: { title: 'x' } })).c).toBe(400);
    expect((await s.call('GET /today', 'marketing')).b.data.length).toBe(1);
  });
  test('calendar: owner edits, validates; DM team reads only', async () => {
    const s = setup(); expect((await s.call('PUT /calendar', 'marketing', { body: { events: [] } })).c).toBe(403);
    expect((await s.call('PUT /calendar', 'root_admin', { body: { events: [{ id: 'd', name: 'Diwali' }] } })).c).toBe(400);
    expect((await s.call('PUT /calendar', 'root_admin', { body: { events: [{ id: 'd', name: 'Diwali', date: '2026-11-08' }] } })).c).toBe(200);
    expect((await s.call('GET /calendar', 'marketing')).b.data.length).toBe(1);
  });
  test('calendar add and remove one event (what the screen uses)', async () => {
    const s = setup(); expect((await s.call('POST /calendar', 'marketing', { body: { name: 'Pongal', date: '2027-01-14' } })).c).toBe(403);
    expect((await s.call('POST /calendar', 'root_admin', { body: { name: 'P' } })).c).toBe(400);
    const a = await s.call('POST /calendar', 'root_admin', { body: { name: 'Pongal', date: '2027-01-14' } }); expect(a.c).toBe(201);
    expect((await s.call('DELETE /calendar/:id', 'marketing', { params: { id: a.b.data.id } })).c).toBe(403);
    expect((await s.call('DELETE /calendar/:id', 'root_admin', { params: { id: 'nope' } })).c).toBe(404);
    expect((await s.call('DELETE /calendar/:id', 'root_admin', { params: { id: a.b.data.id } })).c).toBe(200); expect((await s.call('GET /calendar', 'root_admin')).b.data.length).toBe(0);
  });
});
describe('week plan route', () => {
  test('owner and DM team can read it; a failing facts source does not break it', async () => {
    const s = setup(); await s.call('POST /refresh', 'root_admin');
    for (const role of ['root_admin', 'marketing']) { const r = await s.call('GET /plan', role); expect(r.c).toBe(200); expect(Array.isArray(r.b.data)).toBe(true); expect(r.b.data.length).toBeGreaterThan(0); }
  });
});
