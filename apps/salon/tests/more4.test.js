const { call } = require('./fake'); const { setupMore, ownerOf, staffOf, B } = require('./helpers'); const SP = require('../src/staffPay');
describe('Phase 2 (4): staff attendance, leave, shifts, payslip', () => {
  test('pure: working days skip closed weekdays; paid days count half days and paid leave; unmarked days are shown; net never below zero', () => {
    expect(SP.workingDays('2026-11', [0])).toBe(25); expect(SP.workingDays('2026-02', [0])).toBe(24);
    const p = SP.payslip({ month: '2026-11', baseSalary: 25000, summary: { present: 20, half: 2, paid_leave: 1, absent: 1, unpaid_leave: 0 }, commission: 1500, advances: 2000 });
    expect(p.paidDays).toBe(22); expect(p.salaryPay).toBe(22000); expect(p.unmarkedDays).toBe(1); expect(p.net).toBe(21500); expect(p.currency).toBe('INR');
    const q = SP.payslip({ month: '2026-11', baseSalary: 1000, summary: { present: 1 }, advances: 5000 }); expect(q.net).toBe(0); expect(q.carryForward).toBeGreaterThan(0);
    expect(SP.payslip({ month: 'x', baseSalary: 1 }).error).toMatch(/month/); expect(SP.payslip({ month: '2026-11', baseSalary: -1 }).error).toMatch(/negative/);
    expect(SP.leaveDays('2026-11-06', '2026-11-09', [0])).toEqual(['2026-11-06', '2026-11-07', '2026-11-09']);
    expect(SP.validShifts([{ weekday: 1, start: 600, end: 780 }]).value.length).toBe(1); expect(SP.validShifts([{ weekday: 9, start: 600, end: 780 }]).error).toMatch(/weekday/);
    expect(SP.monthSummary([{ staffId: 'a', day: '2026-11-01', status: 'present' }, { staffId: 'a', day: '2026-10-31', status: 'present' }, { staffId: 'a', day: '2026-11-02', status: 'bogus' }], '2026-11')).toEqual({ a: { present: 1, half: 0, absent: 0, paid_leave: 0, unpaid_leave: 0 } });
  });
  test('owner marks attendance (re-marking replaces), cannot mark the future or another business\'s staff; staff cannot mark', async () => {
    const s = await setupMore(); const t = B.istParts().date; const mark = (who, body) => call(s.more, 'PUT', '/attendance', { ...who, body });
    expect((await mark(ownerOf(s.A.id), { staffId: s.A.staffId, day: t, status: 'present' })).code).toBe(200); expect((await mark(ownerOf(s.A.id), { staffId: s.A.staffId, day: t, status: 'half' })).code).toBe(200);
    expect((await s.M.Attendance.find({ tenantId: s.A.id })).length).toBe(1); expect((await s.M.Attendance.findOne({ tenantId: s.A.id })).status).toBe('half');
    expect((await mark(ownerOf(s.A.id), { staffId: s.A.staffId, day: B.addDays(t, 1), status: 'present' })).code).toBe(400); expect((await mark(ownerOf(s.A.id), { staffId: s.A.staffId, day: t, status: 'x' })).code).toBe(400);
    expect((await mark(ownerOf(s.Bt.id), { staffId: s.A.staffId, day: t, status: 'present' })).code).toBe(404); expect((await mark(staffOf(s.A.id, s.A.staffId), { staffId: s.A.staffId, day: t, status: 'present' })).code).toBe(403);
    const list = await call(s.more, 'GET', '/attendance', { ...ownerOf(s.Bt.id), query: { month: t.slice(0, 7) } }); expect(list.body.data.rows.length).toBe(0);
  });
  test('leave: staff asks for their own only, owner approves and the days are filled, unpaid by default, decided once', async () => {
    const s = await setupMore(); const t = B.istParts().date; const from = B.addDays(t, 3); const to = B.addDays(t, 4);
    const ask = await call(s.more, 'POST', '/leave', { ...staffOf(s.A.id, s.A.staffId), body: { staffId: 'ignored', from, to, kind: 'paid' } }); expect(ask.code).toBe(201); expect(ask.body.data.staffId).toBe(s.A.staffId);
    expect((await call(s.more, 'POST', '/leave/:id/decide', { ...staffOf(s.A.id, s.A.staffId), params: { id: ask.body.data.id }, body: { approve: true } })).code).toBe(403);
    expect((await call(s.more, 'POST', '/leave/:id/decide', { ...ownerOf(s.Bt.id), params: { id: ask.body.data.id }, body: { approve: true } })).code).toBe(404);
    expect((await call(s.more, 'POST', '/leave/:id/decide', { ...ownerOf(s.A.id), params: { id: ask.body.data.id }, body: { approve: true } })).code).toBe(200);
    const filled = await s.M.Attendance.find({ tenantId: s.A.id }); expect(filled.length > 0 && filled.every((r) => r.status === 'paid_leave')).toBe(true);
    expect((await call(s.more, 'POST', '/leave/:id/decide', { ...ownerOf(s.A.id), params: { id: ask.body.data.id }, body: { approve: true } })).code).toBe(404);
    expect((await call(s.more, 'GET', '/leave', { ...staffOf(s.A.id, 'other') })).body.data.length).toBe(0);
    expect((await call(s.more, 'POST', '/leave', { ...ownerOf(s.A.id), body: { staffId: s.A.staffId, from: to, to: from } })).code).toBe(400);
  });
  test('payslip: owner sets salary, commission comes from live bills only, advances are taken off, staff sees only their own, other business sees nothing', async () => {
    const s = await setupMore(); const t = B.istParts().date; const month = t.slice(0, 7); const sid = s.A.staffId; const M = s.M;
    expect((await call(s.more, 'PUT', '/staff/:id/salary', { ...ownerOf(s.A.id), params: { id: sid }, body: { baseSalary: 26000 } })).code).toBe(200); expect((await call(s.more, 'PUT', '/staff/:id/salary', { ...ownerOf(s.Bt.id), params: { id: sid }, body: { baseSalary: 1 } })).code).toBe(404);
    await M.Bill.create({ tenantId: s.A.id, number: 'B1', date: t, commissions: { [sid]: 400 }, status: 'paid' }); await M.Bill.create({ tenantId: s.A.id, number: 'B2', date: t, commissions: { [sid]: 999 }, status: 'void' });
    expect((await call(s.more, 'POST', '/advances', { ...ownerOf(s.A.id), body: { staffId: sid, amount: 1000, date: t } })).code).toBe(201);
    const p = await call(s.more, 'GET', '/payslip', { ...ownerOf(s.A.id), query: { staffId: sid, month } }); expect(p.code).toBe(200); expect(p.body.data.commission).toBe(400); expect(p.body.data.advances).toBe(1000); expect(p.body.data.baseSalary).toBe(26000);
    expect((await call(s.more, 'GET', '/payslip', { ...staffOf(s.A.id, sid), query: { staffId: 'someone-else', month } })).body.data.staffName).toBe('Alpha stylist');
    const other = await M.Staff.create({ tenantId: s.A.id, name: 'Other' }); expect((await call(s.more, 'GET', '/payslip', { ...staffOf(s.A.id, String(other._id)), query: { staffId: sid, month } })).body.data.staffName).toBe('Other');
    expect((await call(s.more, 'GET', '/payslip', { ...ownerOf(s.Bt.id), query: { staffId: sid, month } })).code).toBe(404);
    expect((await call(s.more, 'PUT', '/shifts', { ...ownerOf(s.A.id), body: { staffId: sid, shifts: [{ weekday: 1, start: 600, end: 780 }, { weekday: 2, start: 600, end: 780 }] } })).code).toBe(200);
    expect((await call(s.more, 'GET', '/shifts', ownerOf(s.A.id))).body.data.length).toBe(2); expect((await call(s.more, 'GET', '/shifts', ownerOf(s.Bt.id))).body.data.length).toBe(0);
  });
});
describe('Phase 2 (4): pay list for the panel', () => {
  test('one line per staff member of this business only; staff login refused', async () => {
    const s = await setupMore(); await s.M.Staff.create({ tenantId: s.Bt.id, name: 'Bravo two' });
    const r = await call(s.more, 'GET', '/payslips/month', ownerOf(s.A.id)); expect(r.body.data.length).toBe(1); expect(r.body.data[0].staffName).toBe('Alpha stylist');
    expect((await call(s.more, 'GET', '/payslips/month', staffOf(s.A.id, s.A.staffId))).code).toBe(403);
  });
});
