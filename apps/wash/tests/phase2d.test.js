const B = require('../src/booking'); const { createPublicBookingRouter } = require('../src/publicBooking');
const { createWashRouter } = require('../src/routes'); const { makeFakeModels } = require('./fakeModels');
const T1 = 'aaaaaaaaaaaaaaaaaaaaaaa1', T2 = 'aaaaaaaaaaaaaaaaaaaaaaa2';
const good = { name: 'Arun', phone: '9876543210', day: '2026-11-13', slot: '10:30', consent: true, plate: 'TN09AB1234', klass: 'sedan', pickup: true, note: 'gate 2' };
describe('booking rules', () => {
  test('request checks: consent, phone, day window, slot list, plate, plain words', () => {
    expect(B.checkRequest(good, '2026-11-12').value.slot).toBe('10:30');
    expect(B.checkRequest({ ...good, consent: false }, '2026-11-12').error).toMatch(/tick/);
    expect(B.checkRequest({ ...good, phone: '12345' }, '2026-11-12').error).toMatch(/10-digit/);
    expect(B.checkRequest({ ...good, day: '2026-11-11' }, '2026-11-12').error).toMatch(/Choose a day/);
    expect(B.checkRequest({ ...good, day: '2026-12-01' }, '2026-11-12').error).toMatch(/Choose a day/);
    expect(B.checkRequest({ ...good, slot: '23:00' }, '2026-11-12').error).toMatch(/time/);
    expect(B.checkRequest({ ...good, plate: 'ZZZ' }, '2026-11-12').error).toMatch(/plate/);
    expect(B.checkRequest({ ...good, name: '<b>x</b>' }, '2026-11-12').error).toMatch(/plain words/);
    expect(B.checkRequest({ ...good, klass: 'tank' }, '2026-11-12').error).toMatch(/class/);
    expect(B.checkRequest(null, '2026-11-12').error).toMatch(/Fill/);
  });
  test('tokens are 48 hex characters and different each time; limiter blocks the sixth call and forgets after the window', () => {
    const a = B.newToken(); expect(B.TOKEN.test(a)).toBe(true); expect(a === B.newToken()).toBe(false);
    let t = 0; const lim = B.makeLimiter(5, 1000, () => t);
    for (let i = 0; i < 5; i++) expect(lim('k')).toBe(true);
    expect(lim('k')).toBe(false); expect(lim('other')).toBe(true); t = 2000; expect(lim('k')).toBe(true);
  });
  test('page escapes the business name and has no third-party script; header blocks everything else', () => {
    const html = B.renderPage({ businessName: '<script>alert(1)</script>Shine', token: B.newToken(), today: '2026-11-12', nonce: 'abc' });
    expect(html.includes('<script>alert(1)')).toBe(false); expect(html).toMatch(/&lt;script&gt;/); expect(html.includes('src=')).toBe(false);
    expect(B.securityHeaders('abc')['Content-Security-Policy']).toMatch(/default-src 'none'.*script-src 'nonce-abc'/);
  });
});
function pub(extra = {}) {
  const h = {}; const router = { get: (p, f) => (h['GET ' + p] = f), post: (p, f) => (h['POST ' + p] = f) }; const M = makeFakeModels();
  createPublicBookingRouter({ express: { Router: () => router }, models: M, now: () => new Date('2026-11-12T08:00:00Z'), ...extra });
  const call = async (key, { params = {}, body = {}, ip = '1.1.1.1' } = {}) => { const o = { headers: {} }; await h[key]({ params, body, ip }, { set: (k, v) => { o.headers[k] = v; }, type() { return this; }, send: (b) => { o.text = b; if (!o.c) o.c = 200; }, status(c) { o.c = c; return this; }, json(b) { o.b = b; if (!o.c) o.c = 200; } }); return o; };
  return { call, M };
}
describe('public booking routes', () => {
  test('page and request work with the right token; wrong, short or switched-off links all give the same 404', async () => {
    const P = pub(); const token = B.newToken(); const t = await P.M.Tenant.create({ businessName: 'Shine Wash', bookingToken: token });
    const page = await P.call('GET /:token', { params: { token } }); expect(page.c).toBe(200); expect(page.text).toMatch(/Shine Wash/); expect(page.headers['Content-Security-Policy']).toMatch(/nonce-/);
    expect((await P.call('GET /:token', { params: { token: 'x'.repeat(48) } })).c).toBe(404);
    expect((await P.call('POST /:token/request', { params: { token: B.newToken() }, body: good })).c).toBe(404);
    const r = await P.call('POST /:token/request', { params: { token }, body: good }); expect(r.c).toBe(201);
    expect(P.M.Booking.rows.length).toBe(1); expect(String(P.M.Booking.rows[0].tenantId)).toBe(String(t._id)); expect(P.M.Booking.rows[0].status).toBe('new'); expect(P.M.Booking.rows[0].consentAt instanceof Date).toBe(true);
    expect((await P.call('POST /:token/request', { params: { token }, body: { ...good, consent: false } })).c).toBe(400);
    const off = pub({ isOpen: () => false }); const t2 = B.newToken(); await off.M.Tenant.create({ businessName: 'Old', bookingToken: t2 });
    expect((await off.call('POST /:token/request', { params: { token: t2 }, body: good })).c).toBe(404); expect((await off.call('GET /:token', { params: { token: t2 } })).c).toBe(404);
  });
  test('rate limit stops a flood from one caller; a duplicate request is answered kindly; too many waiting requests are refused', async () => {
    const P = pub({ limiter: B.makeLimiter(3) }); const token = B.newToken(); await P.M.Tenant.create({ businessName: 'Shine', bookingToken: token });
    const codes = []; for (let i = 0; i < 5; i++) codes.push((await P.call('POST /:token/request', { params: { token }, body: { ...good, slot: '1' + i + ':00'.slice(0, 0) + (i % 2 ? ':30' : ':00') } })).c);
    expect(codes.filter((c) => c === 429).length).toBeGreaterThan(0);
    const Q = pub(); const tk = B.newToken(); const tt = await Q.M.Tenant.create({ businessName: 'Full', bookingToken: tk });
    for (let i = 0; i < 200; i++) await Q.M.Booking.create({ tenantId: String(tt._id), status: 'new', name: 'x', phone: '9876543210', day: '2026-11-13', slot: '10:00' });
    expect((await Q.call('POST /:token/request', { params: { token: tk }, body: good })).c).toBe(429);
    const D = pub(); const dk = B.newToken(); await D.M.Tenant.create({ businessName: 'Dup', bookingToken: dk });
    D.M.Booking.create = async () => { const e = new Error('dup'); e.code = 11000; throw e; };
    const dup = await D.call('POST /:token/request', { params: { token: dk }, body: good }); expect(dup.c).toBe(200); expect(dup.b.message).toMatch(/already have/);
  });
});
function owner() {
  const h = {}; const router = { use: () => {}, get: (p, ...f) => (h['GET ' + p] = f), post: (p, ...f) => (h['POST ' + p] = f), put: (p, ...f) => (h['PUT ' + p] = f) };
  const M = makeFakeModels(); createWashRouter({ express: { Router: () => router }, models: M, protect: 'P', authorize: () => 'A', tenantOf: (req) => req.user.tenantId, planOf: () => 'growth', now: () => new Date('2026-11-12T08:00:00Z') });
  const call = async (key, tenant, { body = {}, query = {}, params = {}, role = 'admin' } = {}) => { const o = {}; const req = { user: { id: 'u', tenantId: tenant, role }, body, query, params }; const res = { set: () => {}, status(c) { o.c = c; return this; }, json(b) { o.b = b; if (!o.c) o.c = 200; } }; const chain = h[key]; for (let i = 0; i < chain.length; i++) { let went = false; await chain[i](req, res, () => { went = true; }); if (!went) break; } return o; };
  return { call, M };
}
describe('owner side of the booking link', () => {
  test('link is created once, owner only, replaced on rotate (old one stops matching)', async () => {
    const O = owner(); const t = await O.M.Tenant.create({ businessName: 'Shine' }); const tid = String(t._id);
    expect((await O.call('GET /booking-link', tid, { role: 'subadmin' })).c).toBe(403);
    const a = await O.call('GET /booking-link', tid); const b = await O.call('GET /booking-link', tid); expect(a.b.data.path).toBe(b.b.data.path); expect(a.b.data.path).toMatch(/^\/api\/wash-book\/[0-9a-f]{48}$/);
    const r = await O.call('POST /booking-link/rotate', tid); expect(r.b.data.path === a.b.data.path).toBe(false);
    expect(O.M.Tenant.rows.filter((x) => x.bookingToken === a.b.data.path.split('/').pop()).length).toBe(0);
    expect(O.M.Audit.rows.map((x) => x.action)).toEqual(['booking.link', 'booking.rotate']);
  });
  test('requests list and accept or decline stay inside the business', async () => {
    const O = owner(); const bk = await O.M.Booking.create({ tenantId: T1, status: 'new', name: 'Arun', phone: '9876543210', day: '2026-11-13', slot: '10:00' }); const id = String(bk._id);
    expect((await O.call('GET /bookings', T1)).b.data.length).toBe(1); expect((await O.call('GET /bookings', T2)).b.data.length).toBe(0);
    expect((await O.call('POST /bookings/:id/status', T2, { params: { id }, body: { status: 'accepted' } })).c).toBe(404);
    expect((await O.call('POST /bookings/:id/status', T1, { params: { id }, body: { status: 'maybe' } })).c).toBe(400);
    expect((await O.call('POST /bookings/:id/status', T1, { params: { id }, body: { status: 'accepted' } })).c).toBe(200);
    expect((await O.call('GET /bookings', T1)).b.data.length).toBe(0); expect((await O.call('GET /bookings', T1, { query: { status: 'accepted' } })).b.data.length).toBe(1);
  });
});
