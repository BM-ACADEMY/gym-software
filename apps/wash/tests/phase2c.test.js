const PAY = require('../src/payroll');
const { createWashRouter } = require('../src/routes'); const { makeFakeModels } = require('./fakeModels');
function harness() {
  const h = {}; const router = { use: () => {}, get: (p, ...f) => (h['GET ' + p] = f), post: (p, ...f) => (h['POST ' + p] = f), put: (p, ...f) => (h['PUT ' + p] = f) };
  const M = makeFakeModels(); const clock = new Date('2026-11-12T08:00:00Z');
  createWashRouter({ express: { Router: () => router }, models: M, protect: 'P', authorize: () => 'A', tenantOf: (req) => req.user.tenantId, planOf: () => 'growth', now: () => clock });
  const call = async (key, tenant, { body = {}, query = {}, params = {}, role = 'admin' } = {}) => {
    const o = { headers: {} }; const req = { user: { id: 'u', tenantId: tenant, role }, body, query, params };
    const res = { set: () => {}, send: (b) => { o.text = b; }, status(c) { o.c = c; return this; }, json(b) { o.b = b; if (!o.c) o.c = 200; } };
    const chain = h[key]; for (let i = 0; i < chain.length; i++) { let went = false; await chain[i](req, res, () => { went = true; }); if (!went) break; }
    return o;
  };
  return { call, M };
}
const T1 = 'aaaaaaaaaaaaaaaaaaaaaaa1', T2 = 'aaaaaaaaaaaaaaaaaaaaaaa2';
describe('payroll rules', () => {
  test('payslip: absent and leave beyond the paid allowance are unpaid, incentive added, words shown', () => {
    const s = PAY.payslip({ month: '2026-11', name: 'Ravi', monthlySalary: 15000, paidLeavePerMonth: 1, att: { present: 25, absent: 2, leave: 3 }, incentive: 500, jobs: 40 });
    expect(s.daysInMonth).toBe(30); expect(s.unpaidDays).toBe(4); expect(s.base).toBe(13000); expect(s.gross).toBe(13500); expect(s.unmarkedDays).toBe(0);
    expect(s.words).toMatch(/4 unpaid days \(2 absent, 2 leave beyond the 1 paid\)/);
  });
  test('unmarked days count as worked and the payslip says so; leap February; no salary set gives an error', () => {
    const s = PAY.payslip({ month: '2026-11', name: 'Ravi', monthlySalary: 15000, att: { present: 10 }, incentive: 0, jobs: 0 });
    expect(s.base).toBe(15000); expect(s.unmarkedDays).toBe(20); expect(s.words).toMatch(/20 days were not marked and counted as worked/);
    expect(PAY.daysInMonth('2028-02')).toBe(29); expect(PAY.daysInMonth('2026-02')).toBe(28);
    expect(PAY.payslip({ month: '2026-11', monthlySalary: undefined }).error).toMatch(/salary/);
    expect(PAY.payslip({ month: 'x', monthlySalary: 1 }).error).toMatch(/month/);
  });
  test('unpaid days can never be more than the month; incentive that is not a whole number is ignored', () => {
    const s = PAY.payslip({ month: '2026-11', name: 'A', monthlySalary: 3000, paidLeavePerMonth: 0, att: { absent: 40 }, incentive: 12.5 });
    expect(s.unpaidDays).toBe(30); expect(s.base).toBe(0); expect(s.gross).toBe(0);
  });
  test('leave balance, shift and pay-setting checks', () => {
    expect(PAY.leaveBalance({ paidLeavePerMonth: 2, leave: 1 })).toEqual({ allowance: 2, paidLeaveUsed: 1, paidLeaveLeft: 1, unpaidLeave: 0 });
    expect(PAY.checkShift({ day: '2026-11-12', from: '09:00', to: '18:30' }).value.hours).toBe(9.5);
    expect(PAY.checkShift({ day: '2026-11-12', from: '18:00', to: '09:00' }).error).toMatch(/after/);
    expect(PAY.checkShift({ day: '2026-11-12', from: '9:00', to: '18:00' }).error).toMatch(/look like/);
    expect(PAY.checkShift({ day: '2026-11-12', from: '00:00', to: '23:00' }).error).toMatch(/16 hours/);
    expect(PAY.checkPay({ monthlySalary: 12.5 }).error).toMatch(/whole/); expect(PAY.checkPay({ paidLeavePerMonth: 11 }).error).toMatch(/0 to 10/); expect(PAY.checkPay({}).error).toMatch(/Nothing/);
  });
});
describe('payroll routes', () => {
  test('shifts are saved per attendant and day (once), other business cannot use the attendant', async () => {
    const H = harness(); const a = await H.M.Attendant.create({ tenantId: T1, name: 'Ravi', isActive: true }); const id = String(a._id);
    expect((await H.call('POST /shifts', T1, { body: { attendantId: id, day: '2026-11-12', from: '09:00', to: '17:00' } })).c).toBe(201);
    expect((await H.call('POST /shifts', T1, { body: { attendantId: id, day: '2026-11-12', from: '10:00', to: '18:00' } })).c).toBe(201);
    expect(H.M.Shift.rows.length).toBe(1); expect(H.M.Shift.rows[0].from).toBe('10:00');
    expect((await H.call('POST /shifts', T2, { body: { attendantId: id, day: '2026-11-12', from: '09:00', to: '17:00' } })).c).toBe(400);
    expect((await H.call('GET /shifts', T1, { query: { month: '2026-11' } })).b.data.length).toBe(1);
    expect((await H.call('GET /shifts', T2, { query: { month: '2026-11' } })).b.data.length).toBe(0);
  });
  test('pay settings are owner only and audited; payslips use attendance and incentive and stay inside the business', async () => {
    const H = harness(); const a = await H.M.Attendant.create({ tenantId: T1, name: 'Ravi', isActive: true }); const id = String(a._id);
    await H.M.PriceList.create({ tenantId: T1, incentive: { default: { type: 'percent', value: 10 } } });
    expect((await H.call('PUT /attendants/:id/pay', T1, { params: { id }, body: { monthlySalary: 15000 }, role: 'subadmin' })).c).toBe(403);
    expect((await H.call('PUT /attendants/:id/pay', T2, { params: { id }, body: { monthlySalary: 15000 } })).c).toBe(404);
    expect((await H.call('PUT /attendants/:id/pay', T1, { params: { id }, body: { monthlySalary: 15000, paidLeavePerMonth: 1 } })).c).toBe(200);
    expect(H.M.Audit.rows.some((r) => r.action === 'pay.settings')).toBe(true);
    for (let d = 1; d <= 3; d++) await H.M.Attendance.create({ tenantId: T1, attendantId: id, day: '2026-11-0' + d, status: d === 3 ? 'absent' : 'present' });
    await H.M.Job.create({ tenantId: T1, number: 1, plate: 'TN09AB1234', day: '2026-11-05', state: 'delivered', total: 500, attendantId: id, klass: 'sedan', payments: [] });
    const r = await H.call('GET /payslips', T1, { query: { month: '2026-11' } });
    expect(r.b.data.slips.length).toBe(1); expect(r.b.data.slips[0].incentive).toBe(50); expect(r.b.data.slips[0].unpaidDays).toBe(1); expect(r.b.data.slips[0].base).toBe(14500); expect(r.b.data.slips[0].gross).toBe(14550);
    expect((await H.call('GET /payslips', T2, { query: { month: '2026-11' } })).b.data.slips.length).toBe(0);
    expect((await H.call('GET /payslips/:id', T1, { params: { id }, query: { month: '2026-11' }, role: 'subadmin' })).c).toBe(403);
    expect((await H.call('GET /payslips/:id', T2, { params: { id }, query: { month: '2026-11' } })).c).toBe(404);
  });
});
describe('attendant salary at creation', () => {
  test('only the owner may set salary details; others add a name only', async () => {
    const H = harness();
    expect((await H.call('POST /attendants', T1, { body: { name: 'Ravi', monthlySalary: 12000 }, role: 'subadmin' })).c).toBe(403);
    expect((await H.call('POST /attendants', T1, { body: { name: 'Ravi', monthlySalary: 12000, paidLeavePerMonth: 2 } })).b.data.monthlySalary).toBe(12000);
    expect((await H.call('POST /attendants', T1, { body: { name: 'Sam' }, role: 'subadmin' })).c).toBe(201);
    expect((await H.call('POST /attendants', T1, { body: { name: 'Bad', monthlySalary: 1.5 } })).c).toBe(400);
  });
});
