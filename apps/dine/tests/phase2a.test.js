const P = require('../src/publicPages'); const { createPublicRouter } = require('../src/publicRoutes');
const { build, TID, mkModels } = require('./p2fake');
const TOKEN = 'a1'.repeat(24);
describe('QR menu page and order link (Dine Phase 2)', () => {
  test('menu page escapes venue text, hides liquor and unavailable items, shows variants and FSSAI', () => {
    const h = P.menuPage({ name: '<b>Cafe</b>', address: 'MG Road', fssai: '12345678901234', waNumber: '9876543210' }, [
      { name: 'Tea <script>', category: 'Drinks', price: 20, kind: 'drink', variants: [{ name: 'Large', price: 30 }] },
      { name: 'Whisky', category: 'Bar', price: 300, kind: 'liquor' }, { name: 'Old', category: 'Drinks', price: 5, isActive: false }]);
    expect(h.indexOf('<b>Cafe</b>')).toBe(-1); expect(h).toContain('&lt;b&gt;Cafe'); expect(h.indexOf('<script>')).toBe(-1);
    expect(h.indexOf('Whisky')).toBe(-1); expect(h.indexOf('Old')).toBe(-1); expect(h).toContain('Large Rs 30'); expect(h).toContain('FSSAI licence no. 12345678901234');
    expect(h).toContain('https://wa.me/919876543210');
  });
  test('order link is only a wa.me link; bad number gives nothing; quantities are limited', () => {
    expect(P.waOrderLink('12345', [])).toBe(null);
    const l = P.waOrderLink('9876543210', [{ name: 'Tea', qty: 500 }], { table: 'T1' });
    expect(l.indexOf('https://wa.me/919876543210?text=')).toBe(0); expect(decodeURIComponent(l)).toContain('99 x Tea'); expect(decodeURIComponent(l)).toContain('table T1');
  });
  test('shell pages hold no venue data and refuse nothing themselves (the API does)', () => {
    const k = P.shellPage('kitchen'); const t = P.shellPage('tables');
    expect(k).toContain('/api/dine/kitchen?station='); expect(t).toContain('/api/dine/orders'); expect(k.indexOf(TID)).toBe(-1);
    expect(k).toContain('Please sign in to Dine first.');
  });
  test('public router: wrong token and unknown token are the same 404; right token shows the menu; busy address gets 429', async () => {
    const routes = {}; const router = { get: (p, h) => { routes[p] = h; } };
    const { M } = mkModels({ 'Tenant.findOne': (q) => (q['settings.venue.menuToken'] === TOKEN ? { _id: TID, venueName: 'Cafe', settings: { venue: { address: 'A' } } } : null), 'MenuItem.find': [{ name: 'Tea', price: 20, category: 'Drinks', kind: 'drink', isActive: true }] });
    createPublicRouter({ express: { Router: () => router }, models: M, perMinute: 3 });
    const call = async (path, token) => { const o = {}; await routes[path]({ params: { token }, ip: '1.1.1.1' }, { set() {}, status(c) { o.c = c; return this; }, send(b) { o.b = b; return this; } }); return o; };
    expect((await call('/menu/:token', 'bad')).c).toBe(404);
    expect((await call('/menu/:token', 'f0'.repeat(24))).c).toBe(404);
    const ok = await call('/menu/:token', TOKEN); expect(ok.c).toBe(200); expect(ok.b).toContain('Tea');
    expect((await call('/menu/:token', TOKEN)).c).toBe(429);
  });
  test('venue settings: owner or manager only, bad numbers refused, menu link rotates and old link is forgotten', async () => {
    const { run, calls } = build();
    expect((await run('put', '/settings/venue', { body: { fssai: '123' } })).status).toBe(400);
    expect((await run('put', '/settings/venue', { body: { waNumber: '12345' } })).status).toBe(400);
    expect((await run('put', '/settings/venue', { body: { fssai: '12345678901234', waNumber: '9876543210' } })).status).toBe(200);
    expect((await run('put', '/settings/venue', { role: 'captain', user: { id: 'u', tenantId: TID, role: 'subadmin', staffRole: 'captain' }, body: { fssai: '12345678901234' } })).status).toBe(403);
    const r = await run('post', '/settings/menu-link/rotate'); expect(r.status).toBe(200); expect(/^\/dine-public\/menu\/[a-f0-9]{48}$/.test(r.b.data.menuLink)).toBe(true);
    expect(calls.some((c) => c.model === 'Activity' && c.args[0].action === 'menu.link.rotate')).toBe(true);
  });
  test('order-link route needs the WhatsApp number first and sends nothing', async () => {
    expect((await build().run('get', '/order-link')).status).toBe(400);
    const { run, calls } = build({ over: { 'Tenant.findById': { _id: TID, venueName: 'Cafe', settings: { venue: { waNumber: '9876543210' } } } } });
    const o = await run('get', '/order-link'); expect(o.status).toBe(200); expect(o.b.data.link).toContain('wa.me/919876543210');
    expect(calls.some((c) => c.meth === 'create')).toBe(false);
  });
});
