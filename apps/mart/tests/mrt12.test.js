const { model, mkRouter, call } = require('./fake');
const { createMartRouter } = require('../src/routes');
const PM = require('../src/permissions'); const PR = require('../src/payroll'); const SH = require('../src/shifts'); const S = require('../src/session'); const { payslipHtml, payslipsHtml } = require('../src/payslipPage');
const { sessionMiddleware } = require('../src/authRoutes');
const mk = () => {
  const { r, router } = mkRouter();
  const M = { Settings: model(), Expense: model(), Supplier: model(), Purchase: model(), DayClose: model(), Payment: model(), Audit: model(), DeleteRequest: model(), BillDiscount: model(), ActivityLog: model(), Staff: model(), Attendance: model(), Advance: model(), User: model(), UpiLink: model(), Shift: model(), Tenant: model() };
  const P = { PosBill: model(), PosItem: model(), PosCustomer: model() };
  createMartRouter({ express: { Router: () => router }, mongoose: {}, protect: 'P', authorize: () => 'A', tenantOf: (req) => req.user.tenantId, now: () => new Date('2026-11-12T06:00:00Z'), models: M, pos: P, hashFn: async (p) => 'h:' + p, verifyFn: async (p, h) => h === 'h:' + p });
  return { r, M };
};
const A = { user: { id: 'u1', tenantId: 'a', role: 'admin' } }; const B = { user: { id: 'u2', tenantId: 'b', role: 'admin' } };
const SUB = { user: { id: 's1', tenantId: 'a', role: 'subadmin' } }; const CASH = { user: { id: 'c1', tenantId: 'a', role: 'cashier' } };
const run = (role, method, path) => { let out = 'next'; PM.gate(PM.permFor)({ user: { role }, method, path }, { status: (c) => ({ json: () => { out = c; } }) }, () => { out = 'next'; }); return out; };

describe('permissions for the new routes', () => {
  test('every role may change its own password; team password, leave, slips are owner only; managers may enter shifts', () => {
    for (const role of ['admin', 'subadmin', 'cashier', 'stockkeeper']) expect(run(role, 'POST', '/my-password')).toBe('next');
    expect(run('hacker', 'POST', '/my-password')).toBe(403); expect(run('cashier', 'GET', '/my-password')).toBe('next');
    for (const p of ['/team/password', '/leave-balance', '/payslip/print']) { expect(run('subadmin', 'GET', p)).toBe(403); expect(run('cashier', 'POST', p)).toBe(403); }
    expect(run('subadmin', 'POST', '/shifts')).toBe('next'); expect(run('cashier', 'POST', '/shifts')).toBe(403); expect(run('cashier', 'GET', '/upi-links/abc/qr.svg')).toBe('next'); expect(run('stockkeeper', 'GET', '/upi-links/abc/qr.svg')).toBe(403);
  });
});
describe('team password (owner resets a login)', () => {
  test('owner only, 10+ characters, own shop only, not the owner login; old sign-ins end; the log shows no secrets', async () => {
    const { r, M } = mk(); const u = await M.User.create({ tenantId: 'a', name: 'Ravi', email: 'ravi@x.in', role: 'cashier', passwordHash: 'h:old', failedLogins: 3 }); await M.User.create({ tenantId: 'a', name: 'Boss', email: 'boss@x.in', role: 'admin', passwordHash: 'h:boss' });
    const post = (who, body) => call(r['POST /team/password'], { ...who, method: 'POST', body });
    expect((await post(SUB, { email: 'ravi@x.in', password: 'newpassword1' })).c).toBe(403);
    expect((await post(A, { email: 'ravi@x.in', password: 'short' })).c).toBe(400);
    expect((await post(B, { email: 'ravi@x.in', password: 'newpassword1' })).c).toBe(404); // other business cannot reach this login
    expect((await post(A, { email: 'boss@x.in', password: 'newpassword1' })).c).toBe(400);
    expect((await post(A, { email: 'nobody@x.in', password: 'newpassword1' })).c).toBe(404);
    const ok = await post(A, { email: 'RAVI@x.in', password: 'newpassword1' }); expect(ok.c).toBe(200);
    const row = M.User.rows.find((x) => x.email === 'ravi@x.in'); expect(row.passwordHash).toBe('h:newpassword1'); expect(row.failedLogins).toBe(0); expect(row.passwordChangedAt instanceof Date).toBe(true);
    expect(JSON.stringify(ok.b).includes('newpassword1')).toBe(false);
    const log = await call(r['GET /team/password'], { ...A }); expect(log.b.data.length).toBe(1); expect(log.b.data[0].login).toBe('Ravi'); expect(JSON.stringify(log.b).includes('h:')).toBe(false);
    expect((await call(r['GET /team/password'], { ...B })).b.data.length).toBe(0);
    expect((await call(r['GET /team/password'], { ...SUB })).c).toBe(403);
  });
});
describe('my password (self change)', () => {
  test('needs the right current password, a different 10+ character one, ends the cookie; five wrong tries lock', async () => {
    const { r, M } = mk(); const me = await M.User.create({ tenantId: 'a', name: 'Ravi', email: 'ravi@x.in', role: 'cashier', passwordHash: 'h:oldpassword1' });
    const mine = { user: { id: String(me._id), tenantId: 'a', role: 'cashier' } }; const post = (who, body) => call(r['POST /my-password'], { ...who, method: 'POST', body });
    expect((await post(mine, { current: 'wrong', password: 'newpassword1' })).c).toBe(400);
    expect((await post(mine, { current: 'oldpassword1', password: 'short' })).c).toBe(400);
    expect((await post(mine, { current: 'oldpassword1', password: 'oldpassword1' })).c).toBe(400);
    const ok = await post(mine, { current: 'oldpassword1', password: 'newpassword1' }); expect(ok.c).toBe(200); expect(ok.b.signedOut).toBe(true); expect(ok.h['Set-Cookie']).toMatch(/Max-Age=0/);
    const hist = await call(r['GET /my-password'], { ...mine }); expect(hist.b.data.length).toBe(1); expect(JSON.stringify(hist.b).includes('h:')).toBe(false); expect((await call(r['GET /my-password'], { user: { id: 'x', tenantId: 'a', role: 'cashier' } })).b.data.length).toBe(0); expect((await call(r['GET /my-password'], { user: { id: String(me._id), tenantId: 'b', role: 'admin' } })).b.data.length).toBe(0);
    expect(M.User.rows[0].passwordHash).toBe('h:newpassword1'); expect(M.User.rows[0].passwordChangedAt instanceof Date).toBe(true);
    for (let i = 0; i < 5; i++) await post(mine, { current: 'wrong', password: 'newpassword2' });
    expect((await post(mine, { current: 'newpassword1', password: 'newpassword3' })).c).toBe(429);
    const other = { user: { id: String(me._id), tenantId: 'b', role: 'cashier' } }; expect((await post(other, { current: 'newpassword1', password: 'newpassword3' })).c).toBe(401); // same id, wrong shop
  });
  test('a cookie made before the change is refused, one made after is accepted', async () => {
    const K = 'k'.repeat(40); const changed = new Date(Date.now() - 60000); const u = { _id: 'u1', tenantId: 't1', role: 'cashier', passwordChangedAt: changed };
    const M = { User: { findOne: async () => u }, Tenant: { findById: async () => ({}) } };
    const go = async (token) => { let out = 'next'; await sessionMiddleware(K, M)({ headers: { cookie: 'afra_mart=' + encodeURIComponent(token) } }, { status: (c) => ({ json: () => { out = c; } }) }, () => { out = 'next'; }); return out; };
    const before = S.sign({ uid: 'u1', tid: 't1', role: 'cashier' }, K, changed.getTime() - 5000); const after = S.sign({ uid: 'u1', tid: 't1', role: 'cashier' }, K, changed.getTime() + 30000);
    const noIat = (() => { const body = Buffer.from(JSON.stringify({ uid: 'u1', tid: 't1', exp: Date.now() + 1e6 })).toString('base64url'); return body + '.' + require('crypto').createHmac('sha256', K).update(body).digest('base64url'); })();
    expect(await go(before)).toBe(401); expect(await go(noIat)).toBe(401);
    u.passwordChangedAt = undefined; expect(await go(before)).toBe('next'); // never changed: any valid cookie works
    u.passwordChangedAt = new Date(Date.now() - 1000); expect(await go(S.sign({ uid: 'u1', tid: 't1', role: 'cashier' }, K))).toBe('next');
  });
});
describe('UPI QR image', () => {
  test('own link gives an svg, another shop gets 404, an over-long link is refused', async () => {
    const { r, M } = mk(); const l = await M.UpiLink.create({ tenantId: 'a', amount: 250, link: 'upi://pay?pa=shop@upi&pn=Shop&am=250&cu=INR', status: 'created' });
    const ok = await call(r['GET /upi-links/:id/qr.svg'], { ...CASH, params: { id: String(l._id) } }); expect(ok.c).toBe(200); expect(ok.h['Content-Type']).toMatch(/image\/svg\+xml/); expect(ok.text.startsWith('<svg')).toBe(true); expect(ok.h['Cache-Control']).toBe('no-store');
    const lst = await call(r['GET /upi-links'], { ...A }); expect(lst.b.data[0].qr).toBe('/api/mart/upi-links/' + String(l._id) + '/qr.svg'); expect((await call(r['GET /upi-links'], { ...B })).b.data.length).toBe(0);
    expect((await call(r['GET /upi-links/:id/qr.svg'], { ...B, params: { id: String(l._id) } })).c).toBe(404);
    expect((await call(r['GET /upi-links/:id/qr.svg'], { ...A, params: { id: 'zzz' } })).c).toBe(404);
    const big = await M.UpiLink.create({ tenantId: 'a', amount: 1, link: 'x'.repeat(5000), status: 'created' }); expect((await call(r['GET /upi-links/:id/qr.svg'], { ...A, params: { id: String(big._id) } })).c).toBe(400);
  });
});
describe('paid leave allowance', () => {
  const marks = (n) => Array.from({ length: n }, (_, i) => ({ day: `2026-11-${String(i + 1).padStart(2, '0')}`, status: 'paid_leave' }));
  test('rule: leave beyond the allowance is paid as unpaid; no allowance means no limit', () => {
    const p = PR.payslip({ name: 'A', monthlySalary: 3000, month: '2026-11', marks: marks(3), leave: { allowance: 2, usedBefore: 1 } }); expect(p.payableDays).toBe(1); expect(p.leaveOverAllowance).toBe(2); expect(p.leaveRemaining).toBe(0);
    expect(PR.payslip({ name: 'A', monthlySalary: 3000, month: '2026-11', marks: marks(3) }).payableDays).toBe(3);
  });
  test('settings accepts 0 to 60 or empty; payroll and leave balance use earlier months of the same year; other shop sees nothing', async () => {
    const { r, M } = mk(); const put = (who, body) => call(r['PUT /settings'], { ...who, method: 'PUT', body });
    expect((await put(A, { paidLeaveAllowance: 61 })).c).toBe(400); expect((await put(A, { paidLeaveAllowance: 1.5 })).c).toBe(400); expect((await put(A, { paidLeaveAllowance: 2 })).c).toBe(200);
    const s = await M.Staff.create({ tenantId: 'a', name: 'Asha', monthlySalary: 3000 }); await M.Staff.create({ tenantId: 'b', name: 'Other', monthlySalary: 3000 });
    await M.Attendance.create({ tenantId: 'a', staffId: s._id, day: '2026-03-05', status: 'paid_leave' }); await M.Attendance.create({ tenantId: 'a', staffId: s._id, day: '2025-12-05', status: 'paid_leave' }); // last year does not count
    await M.Attendance.create({ tenantId: 'a', staffId: s._id, day: '2026-11-02', status: 'paid_leave' }); await M.Attendance.create({ tenantId: 'a', staffId: s._id, day: '2026-11-03', status: 'paid_leave' });
    const pay = await call(r['GET /payroll'], { ...A, query: { month: '2026-11' } }); expect(pay.b.data.length).toBe(1); expect(pay.b.data[0].payableDays).toBe(1); expect(pay.b.data[0].leaveOverAllowance).toBe(1);
    const bal = await call(r['GET /leave-balance'], { ...A, query: { month: '2026-11' } }); expect(bal.b.allowance).toBe(2); expect(bal.b.data[0].used).toBe(3); expect(bal.b.data[0].remaining).toBe(0);
    const other = await call(r['GET /leave-balance'], { ...B, query: { month: '2026-11' } }); expect(other.b.data.length).toBe(1); expect(other.b.data[0].name).toBe('Other'); expect(other.b.data[0].used).toBe(0);
    expect((await call(r['GET /leave-balance'], { ...SUB, query: {} })).c).toBe(403);
  });
});
describe('shifts', () => {
  test('rules: times, order, 16 hour limit, touching is fine, overlap is not', () => {
    expect(SH.check({ start: '09:00', end: '18:30' }).minutes).toBe(570); expect(SH.check({ start: '9:00', end: '18:00' }).error).toBeTruthy(); expect(SH.check({ start: '18:00', end: '09:00' }).error).toBeTruthy(); expect(SH.check({ start: '00:00', end: '17:00' }).error).toBeTruthy();
    expect(SH.overlaps([{ start: '09:00', end: '14:00' }], { start: '14:00', end: '18:00' })).toBe(false); expect(SH.overlaps([{ start: '09:00', end: '14:00' }], { start: '13:59', end: '18:00' })).toBe(true);
    expect(SH.totals([{ staffId: 's', start: '09:00', end: '13:00' }, { staffId: 's', start: '14:00', end: '18:30' }]).s).toBe(8.5);
  });
  test('add, list with hours, overlap refused, other shop cannot see or delete', async () => {
    const { r, M } = mk(); await M.Staff.create({ tenantId: 'a', name: 'Asha' }); await M.Staff.create({ tenantId: 'b', name: 'Asha' });
    const add = (who, body) => call(r['POST /shifts'], { ...who, method: 'POST', body });
    expect((await add(SUB, { staff: 'Asha', day: '2026-11-13', start: '09:00', end: '17:00' })).c).toBe(201);
    expect((await add(SUB, { staff: 'Nobody', day: '2026-11-13', start: '09:00', end: '17:00' })).c).toBe(404);
    expect((await add(SUB, { staff: 'Asha', day: '2026-11-13', start: '17:00', end: '09:00' })).c).toBe(400);
    expect((await add(SUB, { staff: 'Asha', day: '2027-06-01', start: '09:00', end: '10:00' })).c).toBe(400);
    expect((await add(SUB, { staff: 'Asha', day: '2026-11-13', start: '16:00', end: '20:00' })).c).toBe(409);
    expect((await add(SUB, { staff: 'Asha', day: '2026-11-13', start: '17:00', end: '21:00' })).c).toBe(201);
    const list = await call(r['GET /shifts'], { ...A, query: { month: '2026-11' } }); expect(list.b.data.length).toBe(2); expect(list.b.hoursByStaff.Asha).toBe(12);
    expect((await call(r['GET /shifts'], { ...B, query: { month: '2026-11' } })).b.data.length).toBe(0);
    const id = list.b.data[0].id; expect((await call(r['DELETE /shifts/:id'], { ...B, method: 'DELETE', params: { id } })).c).toBe(404);
    expect((await call(r['DELETE /shifts/:id'], { ...A, method: 'DELETE', params: { id } })).c).toBe(200); expect(M.Shift.rows.length).toBe(1);
  });
});
describe('payslip print page', () => {
  test('owner only, own staff only, escaped text, no-store and a locked-down policy', async () => {
    const { r, M } = mk(); await M.Tenant.create({ _id: 'a', shopName: 'Raja <b>Mart</b>' }); const s = await M.Staff.create({ tenantId: 'a', name: '<script>alert(1)</script>', monthlySalary: 3000 });
    await M.Attendance.create({ tenantId: 'a', staffId: s._id, day: '2026-11-01', status: 'present' });
    const get = (who, q) => call(r['GET /payslip/print'], { ...who, query: q });
    const ok = await get(A, { staffId: String(s._id), month: '2026-11' }); expect(ok.c).toBe(200); expect(ok.h['Content-Type']).toMatch(/text\/html/); expect(ok.h['Cache-Control']).toBe('no-store'); expect(ok.h['Content-Security-Policy']).toMatch(/default-src 'none'/);
    expect(ok.text.includes('<script>alert(1)</script>')).toBe(false); expect(ok.text.includes('&lt;script&gt;')).toBe(true); expect(ok.text.includes('Raja &lt;b&gt;Mart')).toBe(true); expect(/<script/i.test(ok.text)).toBe(false);
    expect((await get(B, { staffId: String(s._id), month: '2026-11' })).c).toBe(404); expect((await get(SUB, { staffId: String(s._id) })).c).toBe(403);
    expect((await get(A, { staffId: 'nope' })).c).toBe(400); expect((await get(A, { staffId: String(s._id), month: '2026-13' })).c).toBe(400);
  });
  test('without staffId everyone in this shop gets one slip each, never another shop', async () => {
    const { r, M } = mk(); await M.Staff.create({ tenantId: 'a', name: 'One', monthlySalary: 3000 }); await M.Staff.create({ tenantId: 'a', name: 'Two', monthlySalary: 3000 }); await M.Staff.create({ tenantId: 'b', name: 'Other', monthlySalary: 3000 });
    const all = await call(r['GET /payslip/print'], { ...A, query: { month: '2026-11' } }); expect(all.c).toBe(200); expect((all.text.match(/<section>/g) || []).length).toBe(2); expect(all.text.includes('Other')).toBe(false);
    expect((await call(r['GET /payslip/print'], { user: { id: 'u9', tenantId: 'zzz', role: 'admin' }, query: {} })).c).toBe(404);
  });
  test('html builder shows the draft warning and the leave line', () => {
    const p = PR.payslip({ name: 'A', monthlySalary: 3000, month: '2026-11', marks: [{ day: '2026-11-01', status: 'paid_leave' }], leave: { allowance: 0, usedBefore: 0 } });
    const h = payslipHtml(p, 'Shop'); expect(h).toMatch(/Draft: 29 day/); expect(h).toMatch(/over the yearly allowance/);
  });
});
