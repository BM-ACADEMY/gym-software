const I = require('../src/ideas');
const mkRouter = () => { const r = {}; return { r, router: { use: (...m) => { r.USE = m; }, get: (p, h) => (r['GET' + p] = h), post: (p, h) => (r['POST' + p] = h) } }; };
const call = async (h, req) => { const o = { h: {} }; await h({ user: { id: 'u1', role: 'root_admin' }, params: {}, query: {}, body: {}, ...req }, { set(k, v) { o.h[k] = v; }, status(c) { o.c = c; return this; }, json(b) { o.b = b; } }); return o; };
const memStore = () => { const rows = []; return { rows, list: async () => rows.slice(), add: async (v, by, k) => { const d = { ...v, id: 'id' + (rows.length + 100000), by, seedKey: k }; rows.push(d); return d; }, seeded: async (k) => rows.some((x) => x.seedKey === k), update: async (id, p) => { const d = rows.find((x) => x.id === id); if (!d) return false; Object.assign(d, p); return true; } }; };
describe('ideas board (IDEA-01)', () => {
  test('clean: title needed, no links or tags, unknown values fall back, status always new', () => {
    expect(I.clean({}).error).toMatch(/title/);
    expect(I.clean({ title: 'x', detail: 'see http://a.b' }).error).toMatch(/links/);
    expect(I.clean({ title: '<b>x</b>' }).error).toMatch(/links/);
    const v = I.clean({ title: 'Idea', area: 'bogus', impact: 'huge', version: 'v9', status: 'done' }).value;
    expect(v).toEqual({ title: 'Idea', detail: '', area: 'all', impact: 'medium', version: 'later', status: 'new' });
  });
  test('order: open statuses first, higher impact first', () => {
    const a = [{ status: 'done', impact: 'high' }, { status: 'new', impact: 'low' }, { status: 'new', impact: 'high' }].sort(I.order);
    expect(a.map((x) => x.status + x.impact)).toEqual(['newhigh', 'newlow', 'donehigh']);
  });
  test('starting list: every row valid, unique keys, only owner can load it, loading twice adds nothing', async () => {
    expect(new Set(I.SEED.map((s) => s.k)).size).toBe(I.SEED.length);
    for (const s of I.SEED) expect(I.clean(s).error).toBe(undefined);
    const { r, router } = mkRouter(); const st = memStore(); const audits = [];
    I.createIdeasRouter({ express: { Router: () => router }, protect: 'P', authorize: (...x) => 'A:' + x.join(), store: st, audit: (a) => audits.push(a) });
    expect(r.USE).toEqual(['P', 'A:root_admin,marketing']);
    expect((await call(r['POST/seed'], { user: { id: 'm', role: 'marketing' } })).c).toBe(403);
    expect((await call(r['POST/seed'], {})).b.message).toMatch(/Added 13/);
    expect((await call(r['POST/seed'], {})).b.message).toMatch(/already/);
    expect(st.rows.length).toBe(I.SEED.length);
  });
  test('marketing can add but lands in later; only the owner moves an idea; unknown action and id are refused; actions audited', async () => {
    const { r, router } = mkRouter(); const st = memStore(); const audits = [];
    I.createIdeasRouter({ express: { Router: () => router }, protect: 'P', authorize: () => 'A', store: st, audit: (a) => audits.push(a) });
    const mk = await call(r['POST/'], { user: { id: 'm', role: 'marketing' }, body: { title: 'Try reels', version: 'v2' } });
    expect(mk.c).toBe(201); expect(mk.b.data.version).toBe('later'); expect(mk.b.data.status).toBe('new');
    const id = mk.b.data.id;
    expect((await call(r['POST/:id/:action'], { user: { id: 'm', role: 'marketing' }, params: { id, action: 'v2' } })).c).toBe(403);
    expect((await call(r['POST/:id/:action'], { params: { id, action: 'v2' } })).b.success).toBe(true);
    expect(st.rows[0].version).toBe('v2'); expect(st.rows[0].status).toBe('planned');
    expect((await call(r['POST/:id/:action'], { params: { id, action: 'explode' } })).c).toBe(400);
    expect((await call(r['POST/:id/:action'], { params: { id: 'nope!', action: 'done' } })).c).toBe(400);
    expect((await call(r['POST/:id/:action'], { params: { id: 'zzzzzzzz', action: 'done' } })).c).toBe(404);
    expect(audits.map((a) => a.action)).toEqual(['idea.add', 'idea.v2']);
    expect(JSON.stringify(audits)).not.toMatch(/Try reels/);
  });
});
