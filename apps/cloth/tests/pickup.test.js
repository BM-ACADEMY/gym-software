const { model, mkRouter, call } = require('./fake');
const PK = require('../src/pickup'); const { createPickupRouter } = require('../src/pickupRoutes'); const { createClothRouter } = require('../src/routes');
describe('alteration pickup link (CLO-09)', () => {
  test('token is 48 hex and different each time; view hides the phone; html escapes and shows balance only when ready', () => {
    const a = PK.newToken(), b = PK.newToken(); expect(PK.tokenOk(a)).toBe(true); expect(a === b).toBe(false); expect(PK.tokenOk('abc')).toBe(false); expect(PK.tokenOk(null)).toBe(false);
    const v = PK.view({ what: '<b>Hem</b>', status: 'ready', readyOn: '2026-11-15', charge: 300, advance: 100, customerPhone: '9876543210' }, 'My Shop');
    expect(JSON.stringify(v).includes('9876543210')).toBe(false); expect(v.balance).toBe(200);
    const h = PK.html(v); expect(h.includes('<b>Hem</b>')).toBe(false); expect(h.includes('Balance to pay at pickup: <b>Rs 200</b>')).toBe(true);
    expect(PK.html(PK.view({ what: 'x', status: 'received', readyOn: '2026-11-15', charge: 300, advance: 0 }, 's')).includes('Balance')).toBe(false);
    expect(PK.html(null)).toMatch(/not valid/);
  });
  test('limiter allows N per window then refuses', () => {
    let t = 0; const l = PK.limiter({ max: 2, windowMs: 1000, now: () => t }); expect(l('a')).toBe(true); expect(l('a')).toBe(true); expect(l('a')).toBe(false); expect(l('b')).toBe(true); t = 2000; expect(l('a')).toBe(true);
  });
  test('owner makes a link (same one again unless rotated); public page serves that one job only; bad token 404; another shop cannot make a link', async () => {
    const { r, router } = mkRouter(); const M = { Settings: model(), Variant: model(), StockMove: model(), Alteration: model(), CustomerInfo: model(), PosCustomer: model(), Expense: model(), DayClose: model(), SupplierBill: model(), Staff: model(), Attendance: model(), BillDiscount: model(), Audit: model(), Tenant: model() };
    createClothRouter({ express: { Router: () => router }, M, protect: 'P', authorize: () => 'A', tenantOf: (req) => req.user.tenantId, now: () => new Date('2026-11-12T06:00:00Z') });
    const job = await M.Alteration.create({ tenantId: 'a', what: 'Shorten sleeves', status: 'ready', readyOn: '2026-11-14', charge: 250, advance: 50, customerPhone: '9000000000' }); await M.Tenant.create({ _id: 'a', shopName: 'Asha Textiles' });
    const P = (x) => ({ user: { id: 'u', tenantId: x, role: 'admin' }, params: { id: String(job._id) }, method: 'POST', body: {} });
    const l1 = await call(r['POST /alterations/:id/pickup-link'], P('a')); const tok = l1.b.data.path.split('/').pop(); expect(PK.tokenOk(tok)).toBe(true);
    expect((await call(r['POST /alterations/:id/pickup-link'], P('a'))).b.data.path.endsWith(tok)).toBe(true);
    expect((await call(r['POST /alterations/:id/pickup-link'], P('b'))).c).toBe(404);
    const rot = await call(r['POST /alterations/:id/pickup-link'], { ...P('a'), body: { rotate: true } }); const tok2 = rot.b.data.path.split('/').pop(); expect(tok2 === tok).toBe(false);
    const pub = mkRouter(); createPickupRouter({ express: { Router: () => pub.router }, M });
    const page = await call(pub.r['GET /:token'], { params: { token: tok2 }, query: {}, ip: '1' }); expect(page.text.includes('Ready for pickup')).toBe(true); expect(page.text.includes('Asha Textiles')).toBe(true); expect(page.text.includes('9000000000')).toBe(false);
    expect((await call(pub.r['GET /:token'], { params: { token: tok }, query: {}, ip: '1' })).c).toBe(404);
    expect((await call(pub.r['GET /:token'], { params: { token: 'zz' }, query: { format: 'json' }, ip: '1' })).c).toBe(404);
  });
});
