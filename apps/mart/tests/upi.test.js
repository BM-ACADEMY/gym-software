const { model, mkRouter, call } = require('./fake');
const { createMartRouter } = require('../src/routes'); const UPI = require('../src/upi'); const PM = require('../src/permissions');
const mk = () => {
  const { r, router } = mkRouter();
  const M = { Settings: model(), Audit: model(), UpiLink: model(), BillDiscount: model(), ActivityLog: model() }; const P = { PosBill: model(), PosItem: model(), PosCustomer: model() };
  createMartRouter({ express: { Router: () => router }, mongoose: {}, protect: 'P', authorize: () => 'A', tenantOf: (req) => req.user.tenantId, now: () => new Date('2026-11-12T06:00:00Z'), models: M, pos: P });
  return { r, M };
};
const A = { user: { id: 'u1', tenantId: 'a', role: 'admin' } }; const B = { user: { id: 'u2', tenantId: 'b', role: 'admin' } };
describe('UPI link rules', () => {
  test('builds a upi:// link with whole rupees and INR; bad id, bad amount refused; the note is cleaned', () => {
    const r = UPI.buildLink({ vpa: 'shop@okbank', payeeName: 'Ravi Stores', amount: 250, note: 'Bill 12 <script>' });
    expect(r.link.startsWith('upi://pay?pa=shop%40okbank&pn=Ravi%20Stores&am=250&cu=INR')).toBe(true); expect(r.link).not.toMatch(/<|>/);
    expect(UPI.buildLink({ vpa: 'bad id', amount: 10 }).error).toMatch(/UPI id/); expect(UPI.buildLink({ vpa: 'a@b', amount: 10 }).error).toMatch(/UPI id/);
    for (const x of [0, -5, 1.5, 100001, 'abc']) expect(!!UPI.buildLink({ vpa: 'shop@okbank', amount: x }).error).toBe(true);
    expect(UPI.validVpa('shop@okbank')).toBe(true); expect(UPI.validVpa('x&y=1@bank')).toBe(false);
  });
});
describe('UPI link routes', () => {
  test('needs the shop UPI id first; saves a link for that shop only; marking paid once; the other shop cannot touch it; cashier may use it', async () => {
    const { r, M } = mk();
    expect((await call(r['POST /upi-links'], { ...A, method: 'POST', body: { amount: 100 } })).c).toBe(400);
    expect((await call(r['PUT /settings'], { ...A, method: 'PUT', body: { upiId: 'not valid' } })).c).toBe(400);
    expect((await call(r['PUT /settings'], { ...A, method: 'PUT', body: { upiId: 'shop@okbank', upiName: 'Ravi Stores' } })).c).toBe(200);
    const c = await call(r['POST /upi-links'], { ...A, method: 'POST', body: { amount: 100, note: 'Bill 5' } }); expect(c.c).toBe(201); expect(c.b.data.link).toMatch(/^upi:\/\/pay\?pa=shop%40okbank/); const id = c.b.data.id;
    expect((await call(r['GET /upi-links'], A)).b.data.length).toBe(1); expect((await call(r['GET /upi-links'], B)).b.data.length).toBe(0);
    expect((await call(r['POST /upi-links/:id/paid'], { ...B, method: 'POST', params: { id } })).c).toBe(404);
    expect((await call(r['POST /upi-links/:id/paid'], { ...A, method: 'POST', params: { id } })).c).toBe(200); expect(M.UpiLink.rows[0].status).toBe('marked_paid');
    expect((await call(r['POST /upi-links/:id/cancel'], { ...A, method: 'POST', params: { id } })).c).toBe(409);
    expect(M.Audit.rows.map((a) => a.action)).toEqual(['settings_change', 'upi_link', 'upi_link_marked_paid']);
    let out = 'next'; PM.gate(PM.permFor)({ user: { role: 'cashier' }, method: 'POST', path: '/upi-links' }, { status: (x) => ({ json: () => { out = x; } }) }, () => {}); expect(out).toBe('next');
  });
});
