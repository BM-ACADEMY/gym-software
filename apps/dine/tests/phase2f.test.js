const PE = require('../src/people'); const { build, TID, UID } = require('./p2fake');
const manager = { id: UID, tenantId: TID, role: 'subadmin', staffRole: 'manager' }; const captain = { id: UID, tenantId: TID, role: 'subadmin', staffRole: 'captain' };
const SID = 'f'.repeat(24);
describe('shifts, leave and payslip (Dine Phase 2)', () => {
  test('shift: times checked, overnight allowed up to 16 hours, overlaps found', () => {
    expect(PE.checkShift({ date: '2026-11-12', from: '18:00', to: '02:00' }).hours).toBe(8);
    expect(() => PE.checkShift({ date: '2026-11-12', from: '18:00', to: '18:00' })).toThrow(); expect(() => PE.checkShift({ date: '2026-11-12', from: '06:00', to: '23:00' })).toThrow();
    expect(() => PE.checkShift({ date: 'x', from: '18:00', to: '20:00' })).toThrow(); expect(() => PE.checkShift({ date: '2026-11-12', from: '25:00', to: '20:00' })).toThrow();
    expect(PE.overlaps([{ from: '10:00', to: '14:00' }], { from: '13:00', to: '17:00' })).toBe(true); expect(PE.overlaps([{ from: '10:00', to: '14:00' }], { from: '14:00', to: '17:00' })).toBe(false);
    expect(PE.overlaps([{ from: '20:00', to: '02:00' }], { from: '21:00', to: '23:00' })).toBe(true);
  });
  test('leave: dates checked, month split into paid and unpaid days, pending and declined ignored', () => {
    expect(PE.checkLeave({ from: '2026-11-10', to: '2026-11-12' }).days).toBe(3); expect(() => PE.checkLeave({ from: '2026-11-12', to: '2026-11-10' })).toThrow(); expect(() => PE.checkLeave({ from: '2026-01-01', to: '2026-03-01' })).toThrow();
    const l = PE.leaveInMonth([{ from: '2026-10-30', to: '2026-11-02', status: 'approved', paid: true }, { from: '2026-11-10', to: '2026-11-11', status: 'approved', paid: false }, { from: '2026-11-20', to: '2026-11-21', status: 'pending' }, { from: '2026-11-25', to: '2026-11-25', status: 'declined' }], '2026-11');
    expect(l).toEqual({ paid: 2, unpaid: 2 });
  });
  test('payslip: hourly pays hours times rate; monthly loses unpaid leave days; advances carry forward; tax is not worked out', () => {
    const h = PE.payslip({ month: '2026-11', pay: { ratePerHour: 100 }, hours: 160.5, advances: 2000 }); expect(h.gross).toBe(16050); expect(h.net).toBe(14050); expect(h.basis).toBe('hourly'); expect(h.note).toContain('not worked out');
    const m = PE.payslip({ month: '2026-11', pay: { monthly: 15000 }, hours: 0, leave: { paid: 1, unpaid: 3 } }); expect(m.gross).toBe(13500); expect(m.net).toBe(13500);
    const c = PE.payslip({ month: '2026-11', pay: { monthly: 3000 }, advances: 5000 }); expect(c.net).toBe(0); expect(c.carryForward).toBe(2000);
    expect(() => PE.payslip({ month: '2026-11', pay: {} })).toThrow(); expect(() => PE.payslip({ month: 'x', pay: { monthly: 1 } })).toThrow();
  });
  test('shift routes: manager adds, overlap refused, staff sees only their own shifts, remove is soft and audited', async () => {
    const u = { _id: SID, name: 'Anu' };
    const t = build({ over: { 'User.findOne': u, 'Shift.create': { _id: SID } } });
    const ok = await t.run('post', '/shifts', { user: manager, body: { userId: SID, date: '2026-11-12', from: '10:00', to: '14:00' } }); expect(ok.status).toBe(201);
    expect((await t.run('post', '/shifts', { user: captain, body: { userId: SID, date: '2026-11-12', from: '10:00', to: '14:00' } })).status).toBe(403);
    const clash = build({ over: { 'User.findOne': u, 'Shift.find': [{ _id: 's', from: '09:00', to: '12:00' }] } });
    expect((await clash.run('post', '/shifts', { user: manager, body: { userId: SID, date: '2026-11-12', from: '10:00', to: '14:00' } })).status).toBe(409);
    expect((await t.run('post', '/shifts', { user: manager, body: { userId: SID, date: '2026-11-12', from: '10:00', to: '10:00' } })).status).toBe(400);
    await t.run('get', '/shifts', { user: captain, query: { from: '2026-11-01', to: '2026-11-30' } });
    const q = t.calls.filter((c) => c.model === 'Shift' && c.meth === 'find').pop().args[0]; expect(q.userId).toBe(UID); expect(q.removed.$ne).toBe(true); expect(String(q.tenantId)).toBe(TID);
    const del = build({ over: { 'Shift.findOneAndUpdate': { _id: SID } } }); expect((await del.run('delete', '/shifts/:id', { user: manager, params: { id: SID } })).status).toBe(200);
    expect(del.calls.find((c) => c.meth === 'findOneAndUpdate').args[1].$set.removed).toBe(true);
  });
  test('leave routes: anyone requests for themselves; only a manager decides; decision once; payslip needs pay set and a manager', async () => {
    const t = build({ over: { 'Leave.findOneAndUpdate': { _id: SID, status: 'approved' }, 'Leave.create': { _id: SID } } });
    const r = await t.run('post', '/leave', { user: captain, body: { from: '2026-11-20', to: '2026-11-21', reason: 'family' } }); expect(r.status).toBe(201);
    expect(t.calls.find((c) => c.model === 'Leave' && c.meth === 'create').args[0].userId).toBe(UID);
    expect((await t.run('post', '/leave/:id/decide', { user: captain, params: { id: SID }, body: { decision: 'approved' } })).status).toBe(403);
    expect((await t.run('post', '/leave/:id/decide', { user: manager, params: { id: SID }, body: { decision: 'maybe' } })).status).toBe(400);
    expect((await t.run('post', '/leave/:id/decide', { user: manager, params: { id: SID }, body: { decision: 'approved', paid: true } })).status).toBe(200);
    expect((await build().run('post', '/leave/:id/decide', { user: manager, params: { id: SID }, body: { decision: 'approved' } })).status).toBe(404);
    expect((await build().run('get', '/payslip', { user: manager, query: { userId: SID, month: '2026-11' } })).status).toBe(400);
    const p = build({ over: { 'StaffPay.findOne': { _id: 'p', ratePerHour: 100, monthly: 0 }, 'Punch.find': [{ userId: SID, kind: 'in', at: '2026-11-03T04:00:00.000Z' }, { userId: SID, kind: 'out', at: '2026-11-03T12:00:00.000Z' }] } });
    const s = await p.run('get', '/payslip', { user: manager, query: { userId: SID, month: '2026-11' } }); expect(s.status).toBe(200); expect(s.b.data.hours).toBe(8); expect(s.b.data.gross).toBe(800);
    expect((await p.run('get', '/payslip', { user: captain, query: { userId: SID, month: '2026-11' } })).status).toBe(403);
  });
  test('pay rate: manager only, whole rupees, staff member must be in this venue', async () => {
    const t = build({ over: { 'User.findOne': { _id: SID } } });
    expect((await t.run('put', '/staff/:userId/pay', { user: manager, params: { userId: SID }, body: { ratePerHour: 120 } })).status).toBe(200);
    expect((await t.run('put', '/staff/:userId/pay', { user: manager, params: { userId: SID }, body: { ratePerHour: 12.5 } })).status).toBe(400);
    expect((await t.run('put', '/staff/:userId/pay', { user: captain, params: { userId: SID }, body: { ratePerHour: 120 } })).status).toBe(403);
    expect((await build().run('put', '/staff/:userId/pay', { user: manager, params: { userId: SID }, body: { monthly: 9000 } })).status).toBe(404);
  });
});
