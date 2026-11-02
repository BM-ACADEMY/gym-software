const A = require('../src/announcements');
const now = new Date('2026-11-20T06:00:00Z'), day = (n) => new Date(now.getTime() + n * 864e5).toISOString();
describe('announcements', () => {
  test('validation: title, message, future end date, no links or tags, end capped at 30 days, products default to all', () => {
    expect(A.clean({ body: 'x', endsAt: day(1) }, now).error).toMatch(/title/);
    expect(A.clean({ title: 't', endsAt: day(1) }, now).error).toMatch(/message/);
    expect(A.clean({ title: 't', body: 'visit http://x.com', endsAt: day(1) }, now).error).toMatch(/links/);
    expect(A.clean({ title: 't', body: '<b>x</b>', endsAt: day(1) }, now).error).toMatch(/links/);
    expect(A.clean({ title: 't', body: 'x', endsAt: day(-1) }, now).error).toMatch(/future/);
    const ok = A.clean({ title: 't', body: 'x', endsAt: day(90), products: ['fit', 'bad', 'fit'] }, now).value;
    expect(ok.products).toEqual(['fit']); expect(new Date(ok.endsAt).getTime()).toBe(now.getTime() + 30 * 864e5);
    expect(A.clean({ title: 't', body: 'x', endsAt: day(2), products: 'all' }, now).value.products.length).toBe(7);
  });
  test('isLive respects product, end date and removal', () => {
    const a = { products: ['fit'], endsAt: day(1) };
    expect(A.isLive(a, 'fit', now)).toBe(true); expect(A.isLive(a, 'hire', now)).toBe(false);
    expect(A.isLive({ ...a, endsAt: day(-1) }, 'fit', now)).toBe(false); expect(A.isLive({ ...a, removedAt: now }, 'fit', now)).toBe(false);
  });
  test('routes: owner-only guard, add is audited, public read rejects unknown product', async () => {
    const r = {}; const router = { use: (...m) => { r.USE = m; }, get: (p, h) => (r['GET' + p] = h), post: (p, h) => (r['POST' + p] = h), delete: (p, h) => (r['DEL' + p] = h) }; const audits = [];
    const store = { add: async (v) => ({ ...v, id: 'n1' }), list: async () => [], remove: async (id) => id === 'n1', live: async () => [{ id: 'n1', title: 't' }] };
    const ex = { Router: () => router };
    A.createAnnouncementsRouter({ express: ex, protect: 'P', authorize: (...x) => 'AUTH:' + x.join(), store, audit: (a) => audits.push(a), now: () => now });
    expect(r.USE).toEqual(['P', 'AUTH:root_admin']);
    const call = async (h, req) => { const o = { h: {} }; await h({ user: { id: 'u1' }, params: {}, query: {}, ...req }, { set(k, v) { o.h[k] = v; }, status(c) { o.c = c; return this; }, json(b) { o.b = b; } }); return o; };
    const bad = await call(r['POST/'], { body: { title: '' } }); expect(bad.c).toBe(400);
    const good = await call(r['POST/'], { body: { title: 't', body: 'x', endsAt: day(3) } }); expect(good.c).toBe(201); expect(audits[0].action).toBe('announcement.add');
    expect((await call(r['DEL/:id'], { params: { id: 'zz' } })).c).toBe(404);
    const r2 = {}; A.createPublicAnnouncementsRouter({ express: { Router: () => ({ get: (p, h) => (r2.get = h) }) }, store, now: () => now });
    expect((await call(r2.get, { query: { product: 'bogus' } })).c).toBe(400);
    expect((await call(r2.get, { query: { product: 'fit' } })).b.data.length).toBe(1);
  });
});
