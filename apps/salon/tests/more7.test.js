const { call } = require('./fake'); const { setupMore, ownerOf, staffOf, doctorOf, openDay, B } = require('./helpers'); const BP = require('../src/bookingPage'); const I = require('../src/internalRoutes');
const KEY = 'k'.repeat(32);
describe('Phase 2 (7): booking page, QR link, clinic extras, internal summary', () => {
  test('pure: page escapes the business name and has a consent box; QR link needs the public address', () => {
    const h = BP.page('Glow <script>alert(1)</script> & "Co"'); expect(h).not.toMatch(/<script>alert/); expect(h).toMatch(/&lt;script&gt;/); expect(h).toMatch(/checkbox/); expect(BP.page('x', { clinic: true })).toMatch(/spine/);
    expect(BP.bookingUrl({}, 'abc')).toBe(null); expect(BP.bookingUrl({ SALON_PUBLIC_URL: 'javascript:x' }, 'abc')).toBe(null); expect(BP.bookingUrl({ SALON_PUBLIC_URL: 'https://x.in/' }, 'abc')).toBe('https://x.in/api/salon-book/abc/page');
  });
  test('route: page is served for a valid link with safe headers, 404 for a wrong link', async () => {
    const s = await setupMore(); const ok = await call(s.pub, 'GET', '/:token/page', { params: { token: s.A.token } });
    expect(ok.code).toBe(200); expect(ok.body).toMatch(/Alpha/); expect(ok.headers['content-security-policy']).toMatch(/default-src 'none'/);
    expect((await call(s.pub, 'GET', '/:token/page', { params: { token: 'z'.repeat(48) } })).code).toBe(404); expect((await call(s.pub, 'GET', '/:token/page', { params: { token: 'bad' } })).code).toBe(404);
  });
  test('route: QR link is owner only, uses the server address, 409 when not set', async () => {
    const s = await setupMore({ env: { SALON_PUBLIC_URL: 'https://salon.example.in' } }); const g = (who) => call(s.more, 'GET', '/settings/booking-qr', who);
    expect((await g(staffOf(s.A.id, s.A.staffId))).code).toBe(403); const r = await g(ownerOf(s.A.id)); expect(r.code).toBe(200); expect(r.body.data.qrText).toBe(`https://salon.example.in/api/salon-book/${s.A.token}/page`);
    const s2 = await setupMore({ env: {} }); expect((await call(s2.more, 'GET', '/settings/booking-qr', ownerOf(s2.A.id))).code).toBe(409);
  });
  test('route: clinic notes are off by default, then doctor and owner only, clinic businesses only, never across businesses', async () => {
    const off = await setupMore({ env: {} }); expect((await call(off.more, 'POST', '/clinic/notes', { ...ownerOf(off.A.id), body: { note: 'x' } })).code).toBe(503);
    const s = await setupMore({ env: { CLINIC_NOTES_ENABLED: 'true' } }); const M = s.M; const clinic = await s.mkTenant('Care', { preset: 'clinic' });
    const pt = await M.Customer.create({ tenantId: clinic.id, name: 'Pat', phone: '9840012345' }); const post = (who, body) => call(s.more, 'POST', '/clinic/notes', { ...who, body });
    expect((await post(staffOf(clinic.id, clinic.staffId), { customerId: String(pt._id), note: 'knee pain' })).code).toBe(403);
    expect((await post(doctorOf(clinic.id, clinic.staffId), { customerId: String(pt._id), note: 'knee pain' })).code).toBe(201); expect((await post(ownerOf(clinic.id), { customerId: String(pt._id), note: '' })).code).toBe(400);
    const get = (who) => call(s.more, 'GET', '/clinic/notes', { ...who, query: { customerId: String(pt._id) } });
    expect((await get(doctorOf(clinic.id, clinic.staffId))).body.data.length).toBe(1); expect((await get(staffOf(clinic.id, clinic.staffId))).code).toBe(403);
    expect((await get(ownerOf(s.A.id))).code).toBe(404); expect((await post(ownerOf(s.A.id), { customerId: String(pt._id), note: 'x' })).code).toBe(404);
    expect((await M.Audit.find({ tenantId: clinic.id })).some((a) => a.action === 'clinic.note.read')).toBe(true);
    expect(JSON.stringify(await M.Audit.find({ tenantId: clinic.id }))).not.toMatch(/knee pain/);
  });
  test('route: doctor sees masked phones; body area is kept for clinics only', async () => {
    const s = await setupMore(); const M = s.M; const clinic = await s.mkTenant('Care2', { preset: 'clinic' }); const d = openDay();
    const mk = (t, body) => call(s.router, 'POST', '/appointments', { ...ownerOf(t.id), body: { date: d, start: 600, staffId: t.staffId, serviceKey: 'haircut', name: 'Pat', phone: '9840012399', consentGiven: true, ...body } });
    const a = await mk(clinic, { bodyArea: 'knee' }); expect(a.code).toBe(201); expect((await M.Appointment.findOne({ _id: a.body.data.id })).bodyArea).toBe('knee');
    const b = await mk(s.A, { bodyArea: 'knee' }); expect(b.code).toBe(201); expect((await M.Appointment.findOne({ _id: b.body.data.id })).bodyArea).toBeFalsy();
    const list = await call(s.router, 'GET', '/appointments', { ...doctorOf(clinic.id), query: { date: d } }); expect(list.body.data[0].customer.phone).toMatch(/\*\*/);
  });
  test('route: internal summary needs the key, returns counts only', async () => {
    const mkSum = I.shapeSummary({ tenants: [{ planKey: null, trialEndsAt: new Date(Date.now() + 5 * 86400000), createdAt: new Date() }], billing: { computeStatus: () => ({ status: 'trial', daysLeft: 5 }), mrrOf: () => 0 } });
    expect(mkSum.product).toBe('salon'); expect(mkSum.schema).toBe(1); expect(mkSum.businesses.total).toBe(1); expect(mkSum.businesses.trial).toBe(1); expect(JSON.stringify(mkSum)).not.toMatch(/phone|email|name/i);
    expect(I.keyOk(KEY, KEY)).toBe(true); expect(I.keyOk('x', KEY)).toBe(false); expect(I.keyOk('short', 'short')).toBe(false); expect(I.keyOk(undefined, undefined)).toBe(false);
  });
});
