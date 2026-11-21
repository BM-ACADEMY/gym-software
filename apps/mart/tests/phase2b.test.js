const { model, mkRouter, call } = require('./fake');
const { createMartRouter } = require('../src/routes');
const PM = require('../src/permissions'); const PR = require('../src/payroll');
const mk = () => {
  const { r, router } = mkRouter();
  const M = { Settings: model(), Expense: model(), Supplier: model(), Purchase: model(), DayClose: model(), Payment: model(), Audit: model(), DeleteRequest: model(), BillDiscount: model(), ActivityLog: model(), Staff: model(), Attendance: model(), Advance: model(), User: model() };
  const P = { PosBill: model(), PosItem: model(), PosCustomer: model() };
  createMartRouter({ express: { Router: () => router }, mongoose: {}, protect: 'P', authorize: () => 'A', tenantOf: (req) => req.user.tenantId, now: () => new Date('2026-11-12T06:00:00Z'), models: M, pos: P, hashFn: async (p) => 'h:' + p.length });
  return { r, M };
};
const A = { user: { id: 'u1', tenantId: 'a', role: 'admin' } }; const B = { user: { id: 'u2', tenantId: 'b', role: 'admin' } }; const SUB = { user: { id: 's1', tenantId: 'a', role: 'subadmin' } };
describe('permissions', () => {
  const run = (role, method, path, lookup = PM.permFor) => { let out = 'next'; PM.gate(lookup)({ user: { role }, method, path }, { status: (c) => ({ json: () => { out = c; } }) }, () => { out = 'next'; }); return out; };
  test('owner can do everything; cashier bills and closes the day but cannot see accounts, staff, audit or settings', () => {
    expect(run('admin', 'GET', '/anything')).toBe('next');
    expect(run('cashier', 'POST', '/udhaar/payments')).toBe('next'); expect(run('cashier', 'POST', '/day-closes')).toBe('next');
    for (const p of ['/expenses', '/settings', '/audit', '/payroll', '/team', '/privacy/export', '/reports/profit-loss', '/suppliers', '/summary']) expect(run('cashier', 'GET', p)).toBe(403);
  });
  test('stock keeper handles stock and supplier bills, not money or people', () => {
    expect(run('stockkeeper', 'GET', '/reports/reorder')).toBe('next'); expect(run('stockkeeper', 'POST', '/purchases')).toBe('next');
    for (const p of ['/supplier-payments', '/expenses', '/udhaar', '/payroll', '/day-closes', '/reports/sales']) expect(run('stockkeeper', 'GET', p)).toBe(403);
  });
  test('manager keeps what the sub-admin had, but not owner-only areas; an unlisted route is owner only; unknown roles get nothing', () => {
    expect(run('subadmin', 'GET', '/reports/profit-loss')).toBe('next'); expect(run('subadmin', 'POST', '/attendance')).toBe('next');
    for (const p of ['/audit', '/team', '/privacy/export', '/payroll', '/staff', '/advances']) expect(run('subadmin', 'GET', p)).toBe(403);
    expect(run('subadmin', 'GET', '/something-new')).toBe(403); expect(run('hacker', 'GET', '/summary')).toBe(403); expect(run(undefined, 'GET', '/summary')).toBe(403);
  });
  test('shared shop routes: cashier bills and reads items, cannot add items or return a bill; stock keeper adds items but cannot bill', () => {
    const pos = (role, m, p) => run(role, m, p, PM.posPermFor);
    expect(pos('cashier', 'POST', '/bills')).toBe('next'); expect(pos('cashier', 'GET', '/items')).toBe('next'); expect(pos('cashier', 'POST', '/items')).toBe(403); expect(pos('cashier', 'POST', '/bills/abc/return')).toBe(403);
    expect(pos('stockkeeper', 'POST', '/items/abc/stock')).toBe('next'); expect(pos('stockkeeper', 'POST', '/bills')).toBe(403); expect(pos('stockkeeper', 'GET', '/customers')).toBe(403);
    expect(pos('subadmin', 'POST', '/bills/abc/return')).toBe('next'); expect(pos('cashier', 'GET', '/unknown')).toBe(403);
  });
});
describe('payslip rules', () => {
  const full = (status) => Array.from({ length: 30 }, (_, i) => ({ day: `2026-11-${String(i + 1).padStart(2, '0')}`, status }));
  test('full month present pays the whole salary; absent days and a half day reduce it; whole rupees', () => {
    expect(PR.payslip({ name: 'A', monthlySalary: 15000, month: '2026-11', marks: full('present') }).net).toBe(15000);
    const m = full('present'); m[0].status = 'absent'; m[1].status = 'half'; m[2].status = 'paid_leave'; m[3].status = 'unpaid_leave';
    const p = PR.payslip({ name: 'A', monthlySalary: 15000, month: '2026-11', marks: m }); expect(p.payableDays).toBe(27.5); expect(p.gross).toBe(13750); expect(p.counts.absent).toBe(1); expect(p.counts.unpaid_leave).toBe(1);
  });
  test('unmarked days are not paid and make it a draft; advances are taken off, never below zero, with the rest carried forward', () => {
    const p = PR.payslip({ name: 'A', monthlySalary: 3000, month: '2026-11', marks: full('present').slice(0, 10), advances: [{ day: '2026-11-05', amount: 500 }, { day: '2026-10-30', amount: 9999 }] });
    expect(p.unmarkedDays.length).toBe(20); expect(p.draft).toBe(true); expect(p.gross).toBe(1000); expect(p.advances).toBe(500); expect(p.net).toBe(500);
    const q = PR.payslip({ name: 'A', monthlySalary: 3000, month: '2026-11', marks: full('present').slice(0, 3), advances: [{ day: '2026-11-02', amount: 900 }] }); expect(q.net).toBe(0); expect(q.advanceCarryForward).toBe(600);
  });
  test('joining mid-month: days before joining are not counted; bad month or salary refused; slip text says DRAFT', () => {
    const p = PR.payslip({ name: 'A', monthlySalary: 3000, month: '2026-11', marks: full('present').slice(14), joinedOn: '2026-11-15' }); expect(p.unmarkedDays.length).toBe(0); expect(p.gross).toBe(1600);
    let e1, e2; try { PR.payslip({ name: 'A', monthlySalary: 1, month: '2026-13', marks: [] }); } catch (e) { e1 = e.code; } try { PR.payslip({ name: 'A', monthlySalary: -1, month: '2026-11', marks: [] }); } catch (e) { e2 = e.code; }
    expect(e1).toBe('PAYROLL_INVALID'); expect(e2).toBe('PAYROLL_INVALID'); expect(PR.slipText(PR.payslip({ name: 'A', monthlySalary: 3000, month: '2026-11', marks: [] }))).toMatch(/DRAFT/);
  });
});
describe('team and payroll routes', () => {
  test('team: owner only, password length, role limited to manager/cashier/stockkeeper, duplicate email refused, switch-off ends the login and not for the owner', async () => {
    const { r, M } = mk();
    expect((await call(r['POST /team'], { ...SUB, method: 'POST', body: {} })).c).toBe(403);
    expect((await call(r['POST /team'], { ...A, method: 'POST', body: { name: 'Ravi', email: 'ravi@x.in', role: 'admin', password: 'longenough' } })).c).toBe(400);
    expect((await call(r['POST /team'], { ...A, method: 'POST', body: { name: 'Ravi', email: 'ravi@x.in', role: 'cashier', password: 'short' } })).c).toBe(400);
    const ok = await call(r['POST /team'], { ...A, method: 'POST', body: { name: 'Ravi', email: 'RAVI@x.in', role: 'cashier', password: 'longenough' } }); expect(ok.c).toBe(201); expect(M.User.rows[0].passwordHash).toBe('h:10'); expect(JSON.stringify(ok.b)).not.toMatch(/h:10/);
    expect((await call(r['POST /team'], { ...B, method: 'POST', body: { name: 'Ravi 2', email: 'ravi@x.in', role: 'cashier', password: 'longenough' } })).c).toBe(409);
    const id = ok.b.data.id; expect((await call(r['POST /team/:id/deactivate'], { ...B, method: 'POST', params: { id } })).c).toBe(404);
    expect((await call(r['POST /team/:id/deactivate'], { ...A, method: 'POST', params: { id } })).c).toBe(200); expect(M.User.rows[0].isActive).toBe(false);
    M.User.rows.push({ _id: 'f'.repeat(24), tenantId: 'a', role: 'admin', email: 'o@x.in' }); expect((await call(r['POST /team/:id/deactivate'], { ...A, method: 'POST', params: { id: 'f'.repeat(24) } })).c).toBe(400);
    expect((await call(r['GET /team'], A)).b.data.every((u) => !('passwordHash' in u))).toBe(true); expect((await call(r['GET /team'], B)).b.data.length).toBe(0);
  });
  test('staff, attendance by name, advances and payslip end to end for one shop; the other shop sees nothing', async () => {
    const { r } = mk();
    expect((await call(r['POST /staff'], { ...A, method: 'POST', body: { name: 'Meena', monthlySalary: 9000, joinedOn: '2026-10-01' } })).c).toBe(201);
    expect((await call(r['POST /staff'], { ...A, method: 'POST', body: { name: 'Bad', monthlySalary: 1.5 } })).c).toBe(400);
    expect((await call(r['POST /attendance'], { ...A, method: 'POST', body: { staff: 'Nobody', status: 'present' } })).c).toBe(404);
    expect((await call(r['POST /attendance'], { ...B, method: 'POST', body: { staff: 'Meena', status: 'present' } })).c).toBe(404);
    expect((await call(r['POST /attendance'], { ...A, method: 'POST', body: { staff: 'Meena', status: 'sleeping' } })).c).toBe(400);
    expect((await call(r['POST /attendance'], { ...A, method: 'POST', body: { staff: 'Meena', status: 'present', day: '2026-12-30' } })).c).toBe(400);
    for (let d = 1; d <= 12; d++) await call(r['POST /attendance'], { ...SUB, method: 'POST', body: { staff: 'Meena', status: 'present', day: `2026-11-${String(d).padStart(2, '0')}` } });
    await call(r['POST /attendance'], { ...A, method: 'POST', body: { staff: 'Meena', status: 'absent', day: '2026-11-12' } });
    expect((await call(r['GET /attendance'], { ...A, query: { month: '2026-11' } })).b.data.length).toBe(12); expect((await call(r['GET /attendance'], { ...B, query: { month: '2026-11' } })).b.data.length).toBe(0);
    expect((await call(r['POST /advances'], { ...SUB, method: 'POST', body: { staff: 'Meena', amount: 100 } })).c).toBe(403);
    expect((await call(r['POST /advances'], { ...A, method: 'POST', body: { staff: 'Meena', amount: 200, day: '2026-11-05' } })).c).toBe(201);
    const pay = await call(r['GET /payroll'], { ...A, query: { month: '2026-11' } }); expect(pay.b.data.length).toBe(1); expect(pay.b.data[0].draft).toBe(true); expect(pay.b.data[0].payableDays).toBe(11); expect(pay.b.data[0].gross).toBe(3300); expect(pay.b.data[0].net).toBe(3100);
    expect((await call(r['GET /payroll'], SUB)).c).toBe(403); expect((await call(r['GET /payroll'], B)).b.data.length).toBe(0); expect(pay.h['Cache-Control']).toBe('no-store');
  });
});
