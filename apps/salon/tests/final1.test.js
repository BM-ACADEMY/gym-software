const { call } = require('./fake'); const { setupMore, ownerOf, staffOf, openDay, B } = require('./helpers');
const { qrMatrix, qrSvg } = require('../src/qrSvg'); const RM = require('../src/reminders');
describe('Salon final list (1): QR picture, reminders, print bill, customer reschedule, days range', () => {
  test('QR: same text gives same picture, size grows with length, finder squares are in place, too-long text is refused', () => {
    const a = qrMatrix('https://x.in/a'); expect(a.length).toBe(21); expect(JSON.stringify(a)).toBe(JSON.stringify(qrMatrix('https://x.in/a')));
    expect(qrMatrix('x'.repeat(60)).length > 21).toBe(true);
    for (const [r, c] of [[0, 0], [0, 14], [14, 0]]) { expect(a[r][c]).toBe(true); expect(a[r + 3][c + 3]).toBe(true); expect(a[r + 1][c + 1]).toBe(false); }
    expect(a[13][8]).toBe(true); // the always-dark module
    const svg = qrSvg('https://x.in/a'); expect(svg.startsWith('<svg')).toBe(true); expect(svg.includes('<script')).toBe(false); expect(svg.includes('viewBox')).toBe(true);
    let threw = false; try { qrMatrix('y'.repeat(300)); } catch (e) { threw = true; } expect(threw).toBe(true);
  });
  test('reminders (pure): only booked visits of customers who agreed; do-not-contact and deleted people are left out; nothing marked sent', () => {
    const cs = [{ _id: 'c1', name: 'Asha Devi', phone: '9840012210', consent: { at: new Date() } }, { _id: 'c2', name: 'No', phone: '9840012211' }, { _id: 'c3', name: 'Dnc', phone: '9840012212', consent: { at: new Date() }, doNotContact: true }, { _id: 'c4', name: 'Gone', phone: '9840012213', consent: { at: new Date() }, anonymisedAt: new Date() }];
    const ap = ['c1', 'c2', 'c3', 'c4'].map((c, i) => ({ _id: 'a' + i, customerId: c, status: 'booked', active: true, date: '2026-11-14', start: 600 + i * 30, serviceName: 'Haircut' }));
    const r = RM.suggestions({ businessName: 'Alpha', date: '2026-11-14', appointments: ap, customers: cs });
    expect(r.list.length).toBe(1); expect(r.leftOut).toBe(3); expect(r.list[0].sent).toBe(false); expect(r.list[0].message.startsWith('Hi Asha,')).toBe(true); expect(r.list[0].time).toBe('10:00'); expect(r.needsApprovedTemplate).toBe(true);
  });
  test('reminders route: tomorrow only, own business only, staff see a masked phone and no link, owner gets the link', async () => {
    const s = await setupMore(); const tom = B.addDays(B.istParts().date, 1);
    const mk = async (tid, staffId, phone, consent) => { const c = await s.M.Customer.create({ tenantId: tid, name: 'Ravi K', phone, consent: consent ? { at: new Date() } : undefined }); await s.M.Appointment.create({ tenantId: tid, staffId, customerId: c._id, serviceKey: 'haircut', serviceName: 'Haircut', date: tom, start: 600, mins: 30, status: 'booked' }); };
    await mk(s.A.id, s.A.staffId, '9840012210', true); await mk(s.Bt.id, s.Bt.staffId, '9840012299', true);
    const o = await call(s.final, 'GET', '/reminders/suggestions', ownerOf(s.A.id)); expect(o.code).toBe(200); expect(o.body.data.list.length).toBe(1);
    expect(o.body.data.list[0].phone).toBe('9840012210'); expect(o.body.data.list[0].whatsappLink.startsWith('https://wa.me/919840012210?text=')).toBe(true); expect(JSON.stringify(o.body).includes('9840012299')).toBe(false);
    const st = await call(s.final, 'GET', '/reminders/suggestions', staffOf(s.A.id, s.A.staffId)); expect(st.body.data.list[0].phone.includes('******')).toBe(true); expect(st.body.data.list[0].whatsappLink).toBe(null);
  });
  test('print bill: owner any bill, staff today only with masked phone, other business 404, voided 409, shop and customer text escaped, no script', async () => {
    const s = await setupMore(); const t = B.istParts().date;
    await s.M.Tenant.updateOne({ _id: s.A.id }, { $set: { businessName: 'Alpha <b>&Co', address: '1 Main Rd' } });
    const c = await s.M.Customer.create({ tenantId: s.A.id, name: 'Meena <i>x</i>', phone: '9840012210' });
    const mk = (patch) => s.M.Bill.create({ tenantId: s.A.id, number: 'B' + Math.random().toString(36).slice(2, 7), customerId: c._id, date: t, lines: [{ name: 'Haircut', qty: 1, unitPrice: 500, total: 500 }], subtotal: 500, discount: 0, taxable: 500, gst: 0, total: 500, taxMode: 'none', payments: [{ method: 'cash', amount: 500 }], currency: 'INR', status: 'paid', ...patch });
    const b1 = await mk({}); const old = await mk({ date: B.addDays(t, -3) }); const voided = await mk({ status: 'void' });
    const get = (who, id, query) => call(s.final, 'GET', '/bills/:id/print', { ...who, params: { id: String(id) }, query: query || {} });
    const o = await get(ownerOf(s.A.id), b1._id, { size: 'A4' }); expect(o.code).toBe(200); expect(o.body.includes('Alpha &lt;b&gt;&amp;Co')).toBe(true); expect(o.body.includes('Meena &lt;i&gt;')).toBe(true); expect(o.body.includes('<script')).toBe(false); expect(o.body.includes('9840012210')).toBe(true);
    expect(o.headers['content-security-policy'].includes("default-src 'none'")).toBe(true);
    const st = await get(staffOf(s.A.id, s.A.staffId), b1._id); expect(st.code).toBe(200); expect(st.body.includes('9840012210')).toBe(false); expect(st.body.includes('******')).toBe(true);
    expect((await get(staffOf(s.A.id, s.A.staffId), old._id)).code).toBe(403); expect((await get(ownerOf(s.A.id), old._id)).code).toBe(200);
    expect((await get(ownerOf(s.Bt.id), b1._id)).code).toBe(404); expect((await get(ownerOf(s.A.id), voided._id)).code).toBe(409); expect((await get(ownerOf(s.A.id), 'zzz')).code).toBe(404);
    expect((await get(ownerOf(s.A.id), b1._id, { size: 'A3' })).code).toBe(200); // unknown size falls back to A5
  });
  test('booking QR picture: owner only, needs the public web address, shows only this business\'s link', async () => {
    const s = await setupMore({ env: { SALON_PUBLIC_URL: 'https://groom.example.in' } }); const g = (who) => call(s.final, 'GET', '/settings/booking-qr.svg', who);
    const o = await g(ownerOf(s.A.id)); expect(o.code).toBe(200); expect(o.headers['content-type'].startsWith('image/svg+xml')).toBe(true); expect(o.body.startsWith('<svg')).toBe(true);
    const b = await g(ownerOf(s.Bt.id)); expect(b.body === o.body).toBe(false); expect((await g(staffOf(s.A.id, s.A.staffId))).code).toBe(403);
    const none = await setupMore({ env: {} }); expect((await call(none.final, 'GET', '/settings/booking-qr.svg', ownerOf(none.A.id))).code).toBe(409);
  });
  test('customer reschedule: needs the booking phone, moves to a free time, refuses a taken time, a done visit, another business\'s link, and bad dates', async () => {
    const s = await setupMore(); const day = openDay(); const day2 = B.addDays(day, 1); const d2 = B.weekday(day2) === 0 ? B.addDays(day2, 1) : day2;
    const book = (start, phone, name) => call(s.pub, 'POST', '/:token/book', { params: { token: s.A.token }, body: { date: day, start, staffId: s.A.staffId, serviceKey: 'haircut', name, phone, consent: true } });
    const a = await book(600, '9840012210', 'Ravi'); const other = await book(630, '9840012211', 'Sita'); expect(a.code).toBe(201);
    const re = (token, id, body) => call(s.pub, 'POST', '/:token/appointments/:id/reschedule', { params: { token, id }, body });
    expect((await re(s.A.token, a.body.data.id, { phone: '9000000000', date: day, start: 660 })).code).toBe(404);
    expect((await re(s.Bt.token, a.body.data.id, { phone: '9840012210', date: day, start: 660 })).code).toBe(404);
    expect((await re(s.A.token, a.body.data.id, { phone: '9840012210', date: day, start: 630 })).code).toBe(409);
    expect((await re(s.A.token, a.body.data.id, { phone: '9840012210', date: 'x', start: 660 })).code).toBe(400);
    expect((await re(s.A.token, a.body.data.id, { phone: '9840012210', date: d2, start: 5 * 60 })).code).toBe(409);
    const ok = await re(s.A.token, a.body.data.id, { phone: '+91 98400 12210', date: d2, start: 660 }); expect(ok.code).toBe(200);
    const row = await s.M.Appointment.findOne({ _id: a.body.data.id, tenantId: s.A.id }); expect(row.date).toBe(d2); expect(row.start).toBe(660);
    expect((await s.M.Appointment.findOne({ _id: other.body.data.id, tenantId: s.A.id })).start).toBe(630);
    await s.M.Appointment.updateOne({ _id: a.body.data.id, tenantId: s.A.id }, { $set: { status: 'done' } }); expect((await re(s.A.token, a.body.data.id, { phone: '9840012210', date: d2, start: 690 })).code).toBe(409);
    await s.M.Appointment.updateOne({ _id: a.body.data.id, tenantId: s.A.id }, { $set: { status: 'cancelled', active: false } }); expect((await re(s.A.token, a.body.data.id, { phone: '9840012210', date: d2, start: 690 })).code).toBe(404);
  });
  test('panel date range: days=7 gives the last 7 days with no dates typed, stays inside this business', async () => {
    const s = await setupMore(); const t = B.istParts().date;
    const mk = (tid, date, taxable) => s.M.Bill.create({ tenantId: tid, number: 'N' + Math.random().toString(36).slice(2, 7), date, lines: [], taxable, total: taxable, status: 'paid' });
    await mk(s.A.id, t, 500); await mk(s.A.id, B.addDays(t, -6), 300); await mk(s.A.id, B.addDays(t, -7), 900); await mk(s.Bt.id, t, 7000);
    const r = await call(s.router, 'GET', '/reports/sales', { ...ownerOf(s.A.id), query: { days: '7' } }); expect(r.code).toBe(200); expect(r.body.data.total).toBe(800); expect(r.body.data.bills).toBe(2);
    expect((await call(s.router, 'GET', '/reports/sales', { ...ownerOf(s.A.id), query: { days: '0' } })).code).toBe(400);
    expect((await call(s.router, 'GET', '/reports/sales', { ...ownerOf(s.A.id), query: { days: '9999' } })).code).toBe(400);
  });
});
