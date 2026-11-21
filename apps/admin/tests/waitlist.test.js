const W = require('../src/waitlist');
const okBody = { name: 'Ravi Kumar', phone: '98400 12210', product: 'fit', businessType: 'Gym', city: 'Puducherry', source: 'instagram', consent: true };
const mkRouter = () => { const r = {}; return { r, router: { use: (...m) => { r.USE = m; }, options: (p, h) => (r['OPT' + p] = h), get: (p, ...h) => (r['GET' + p] = h[h.length - 1], (r['GETG' + p] = h[0])), post: (p, ...h) => (r['POST' + p] = h[h.length - 1], (r['POSTG' + p] = h[0])), delete: (p, ...h) => (r['DEL' + p] = h[h.length - 1], (r['DELG' + p] = h[0])) } }; };
const call = async (h, req) => { const o = { h: {} }; await h({ user: { id: 'u1', role: 'root_admin' }, params: {}, query: {}, headers: {}, body: {}, ip: '1.1.1.1', ...req }, { set(k, v) { o.h[k] = v; }, status(c) { o.c = c; return this; }, json(b) { o.b = b; }, send(b) { o.s = b; }, end() { o.ended = true; } }); return o; };
const mem = () => { const rows = []; return { rows, add: async (v) => { const k = W.dedupeKey(v); const e = rows.find((x) => x.k === k); if (e) { e.hits++; return { created: false }; } rows.push({ ...v, k, hits: 1, id: 'a'.repeat(23) + rows.length, status: 'new' }); return { created: true }; }, list: async () => rows.slice(), markContacted: async (id) => { const x = rows.find((r) => r.id === id); if (x) x.status = 'contacted'; return !!x; }, remove: async (id) => { const i = rows.findIndex((r) => r.id === id); if (i < 0) return false; rows.splice(i, 1); return true; } }; };

describe('waitlist form rules', () => {
  test('consent, name, contact are needed; phone and email are checked; +91 and spaces are cleaned', () => {
    expect(W.clean({ ...okBody, consent: false }).error).toMatch(/tick/);
    expect(W.clean({ ...okBody, consent: 'true' }).error).toMatch(/tick/);
    expect(W.clean({ ...okBody, name: 'R' }).error).toMatch(/name/);
    expect(W.clean({ ...okBody, phone: '12345' }).error).toMatch(/10-digit/);
    expect(W.clean({ ...okBody, phone: '', email: '' }).error).toMatch(/mobile number or an email/);
    expect(W.clean({ ...okBody, phone: '', email: 'bad@' }).error).toMatch(/email/);
    expect(W.clean({ ...okBody, phone: '+91 98400-12210' }).value.phone).toBe('9840012210');
    expect(W.clean({ ...okBody, phone: '09840012210' }).value.phone).toBe('9840012210');
    expect(W.clean({ ...okBody, phone: '', email: ' A@B.IN ' }).value.email).toBe('a@b.in');
  });
  test('links and tags refused; unknown product or source fall back; long text cut; no extra fields kept', () => {
    expect(W.clean({ ...okBody, city: 'see http://x.co' }).error).toMatch(/links/);
    expect(W.clean({ ...okBody, businessType: '<b>gym</b>' }).error).toMatch(/links/);
    const v = W.clean({ ...okBody, product: 'bogus', source: 'bogus', name: 'N'.repeat(300), role: 'admin', status: 'contacted' }).value;
    expect(v.product).toBe('not_sure'); expect(v.source).toBe('site'); expect(v.name.length).toBe(80);
    expect(Object.keys(v).sort()).toEqual(['businessType', 'city', 'email', 'name', 'phone', 'product', 'source']);
  });
  test('same person and product is one row; a different product is another', () => {
    const a = W.clean(okBody).value, b = W.clean({ ...okBody, phone: '9840012210' }).value, c = W.clean({ ...okBody, product: 'groom' }).value;
    expect(W.dedupeKey(a)).toBe(W.dedupeKey(b)); expect(W.dedupeKey(a) === W.dedupeKey(c)).toBe(false);
  });
});
describe('csv and limiter', () => {
  test('formula-safe cells, quotes doubled, header first', () => {
    expect(W.cell('=SUM(A1)')).toBe('"\'=SUM(A1)"'); expect(W.cell('+91')).toBe('"\'+91"'); expect(W.cell('@x')).toBe('"\'@x"'); expect(W.cell('-1')).toBe('"\'-1"');
    expect(W.cell('say "hi"')).toBe('"say ""hi"""'); expect(W.cell('a\nb')).toBe('"a b"');
    const csv = W.toCsv([{ name: '=cmd|x', phone: '9840012210', email: '', product: 'fit', businessType: 'Gym', city: 'P', source: 'site', status: 'new', createdAt: '2026-11-13T00:00:00Z' }]);
    expect(csv.split('\r\n')[0]).toBe('"Name","Phone","Email","Product","Business","City","Source","Status","Joined"');
    expect(csv.split('\r\n')[1].startsWith('"\'=cmd|x","9840012210"')).toBe(true); expect(csv).toMatch(/2026-11-13/);
  });
  test('limiter blocks after max and lets people through after the window', () => {
    let t = 0; const l = W.makeLimiter({ max: 2, windowMs: 1000, now: () => t });
    expect(l.allow('a')).toBe(true); expect(l.allow('a')).toBe(true); expect(l.allow('a')).toBe(false); expect(l.allow('b')).toBe(true);
    t = 1500; expect(l.allow('a')).toBe(true);
  });
});
describe('public route', () => {
  const build = (extra) => { const { r, router } = mkRouter(); const store = mem(); W.createPublicWaitlistRouter({ express: { Router: () => router }, store, origins: ['https://afraventures.in'], ...extra }); return { r, store }; };
  test('good form is stored once; repeat gets the same answer; nothing about others is returned', async () => {
    const { r, store } = build();
    const a = await call(r['POST/'], { body: okBody }); const b = await call(r['POST/'], { body: okBody });
    expect(a.b.success).toBe(true); expect(b.b).toEqual(a.b); expect(store.rows.length).toBe(1); expect(store.rows[0].hits).toBe(2);
    expect(JSON.stringify(a.b)).not.toMatch(/9840012210|Ravi/);
  });
  test('missing consent is 400; hidden field filled means a bot: success shown, nothing stored', async () => {
    const { r, store } = build();
    expect((await call(r['POST/'], { body: { ...okBody, consent: false } })).c).toBe(400);
    const bot = await call(r['POST/'], { body: { ...okBody, website: 'http://spam' } });
    expect(bot.b.success).toBe(true); expect(store.rows.length).toBe(0);
  });
  test('rate limit per visitor address and for the whole site; 429', async () => {
    const { r } = build({ limiter: W.makeLimiter({ max: 2 }), siteLimiter: W.makeLimiter({ max: 3 }) });
    await call(r['POST/'], { body: okBody }); await call(r['POST/'], { body: okBody });
    expect((await call(r['POST/'], { body: okBody })).c).toBe(429);
    const o = await call(r['POST/'], { body: okBody, ip: '2.2.2.2' }); expect(o.c).toBe(429); // site cap of 3 reached
  });
  test('only listed origins get cross-site permission; the list is never offered by GET', async () => {
    const { r } = build();
    const good = await call(r['OPT/'], { headers: { origin: 'https://afraventures.in' } }); expect(good.h['Access-Control-Allow-Origin']).toBe('https://afraventures.in'); expect(good.c).toBe(204);
    const bad = await call(r['OPT/'], { headers: { origin: 'https://evil.example' } }); expect(bad.h['Access-Control-Allow-Origin']).toBe(undefined);
    expect(r['GET/']).toBe(undefined);
  });
  test('a database failure gives a plain 500 and no detail', async () => {
    const { r } = build({ store: { add: async () => { throw new Error('secret db detail'); } } });
    const x = await call(r['POST/'], { body: okBody }); expect(x.c).toBe(500); expect(JSON.stringify(x.b)).not.toMatch(/secret/);
  });
});
describe('owner routes', () => {
  const build = () => { const { r, router } = mkRouter(); const store = mem(); const audits = []; const guards = []; W.createWaitlistRouter({ express: { Router: () => router }, protect: 'P', authorize: (...x) => { guards.push(x.join()); return 'A:' + x.join(); }, store, audit: (a) => audits.push(a) }); return { r, store, audits, guards }; };
  test('sign-in on everything; list and contacted for owner and DM team; export and delete owner only', () => {
    const { r } = build();
    expect(r.USE).toEqual(['P']); expect(r['GETG/']).toBe('A:root_admin,marketing'); expect(r['POSTG/:id/contacted']).toBe('A:root_admin,marketing');
    expect(r['GETG/export.csv']).toBe('A:root_admin'); expect(r['DELG/:id']).toBe('A:root_admin');
  });
  test('contacted, delete and export work and are audited without personal details; bad ids are 400, unknown 404', async () => {
    const { r, store, audits } = build();
    await store.add(W.clean(okBody).value); const id = store.rows[0].id;
    expect((await call(r['POST/:id/contacted'], { params: { id } })).b.success).toBe(true); expect(store.rows[0].status).toBe('contacted');
    const csv = await call(r['GET/export.csv'], {}); expect(csv.h['Content-Type']).toMatch(/text\/csv/); expect(csv.s).toMatch(/Ravi Kumar/);
    expect((await call(r['POST/:id/contacted'], { params: { id: 'x' } })).c).toBe(400);
    expect((await call(r['DEL/:id'], { params: { id: 'b'.repeat(24) } })).c).toBe(404);
    expect((await call(r['DEL/:id'], { params: { id } })).b.success).toBe(true); expect(store.rows.length).toBe(0);
    expect(audits.map((a) => a.action)).toEqual(['waitlist.contacted', 'waitlist.export', 'waitlist.delete']);
    expect(JSON.stringify(audits)).not.toMatch(/Ravi|9840012210/);
  });
});
