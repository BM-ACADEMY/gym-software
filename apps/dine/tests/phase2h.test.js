const { build, TID, OID } = require('./p2fake'); const PE = require('../src/people'); const ST = require('../src/staff');
const PARAMS = { id: OID }; const IID = 'e'.repeat(24); const UID2 = 'f'.repeat(24);
const owner = { id: 'u', tenantId: TID, role: 'admin', staffRole: 'owner' }; const cashier = { id: 'u', tenantId: TID, role: 'subadmin', staffRole: 'cashier' }; const captain = { id: 'u', tenantId: TID, role: 'subadmin', staffRole: 'captain' };
describe('Dine final list: roles for the screens, tables, service-charge refund, restock, overnight shifts, panel lists', () => {
  test('roleOf: saved role wins; no saved role means owner login is owner and anyone else a manager; unknown role may do nothing', () => {
    expect(ST.roleOf({ role: 'admin', staffRole: 'cashier' }).staffRole).toBe('cashier'); expect(ST.roleOf({ role: 'admin' }).staffRole).toBe('owner'); expect(ST.roleOf({ role: 'subadmin' }).staffRole).toBe('manager');
    expect(ST.roleOf({ role: 'subadmin', staffRole: 'kitchen' }).allowed).toEqual(['kot_view']); expect(ST.roleOf({ staffRole: 'nobody' }).allowed).toEqual([]); expect(ST.roleOf({ role: 'admin' }).allowed).toEqual(['*']);
  });
  test('table list: anyone who takes orders reads it, only owner or manager saves it, names checked, no duplicates, kept inside this venue only', async () => {
    const t = build({ over: { 'Tenant.findById': { _id: TID, venueName: 'Cafe', settings: { venue: { tables: ['T1', 'T2'] } } } } });
    const g = await t.run('get', '/settings/tables', { user: captain }); expect(g.status).toBe(200); expect(g.b.data.tables).toEqual(['T1', 'T2']);
    expect((await t.run('put', '/settings/tables', { user: captain, body: { tables: ['A'] } })).status).toBe(403); expect((await t.run('put', '/settings/tables', { user: cashier, body: { tables: ['A'] } })).status).toBe(403);
    for (const bad of [['T1', 't1'], [''], ['x'.repeat(21)], ['<b>'], 'T1', Array.from({ length: 61 }, (_, i) => 'T' + i)]) expect((await t.run('put', '/settings/tables', { body: { tables: bad } })).status).toBe(400);
    const ok = await t.run('put', '/settings/tables', { body: { tables: [' Table  1 ', 'Garden-2', 'மேசை 3'] } }); expect(ok.status).toBe(200); expect(ok.b.data.tables).toEqual(['Table 1', 'Garden-2', 'மேசை 3']);
    const up = t.calls.find((c) => c.model === 'Tenant' && c.meth === 'updateOne'); expect(String(up.args[0]._id)).toBe(TID); expect(up.args[1].$set['settings.venue'].tables.length).toBe(3); expect(up.args[1].$set['settings.venue'].tables.length).toBe(3);
    expect(t.calls.some((c) => c.model === 'Activity' && c.args[0].action === 'settings.tables')).toBe(true);
    const empty = build({ over: { 'Tenant.findById': { _id: TID, settings: {} } } }); expect((await empty.run('get', '/settings/tables')).b.data.tables).toEqual([]);
  });
  const paid = (extra) => ({ _id: OID, number: 'D-9', status: 'paid', returnedAmount: 0, returnedQty: [], credit: 0, serviceCharge: 20, customerPhone: '9876543210', pointsEarned: 0, payments: [{ method: 'cash', amount: 220 }], totals: { total: 200, lines: [{ name: 'Tea', qty: 2, total: 100, itemKey: 'tea' }, { name: 'Dosa', qty: 2, total: 100, itemKey: 'dosa' }] }, events: [], ...(extra || {}) });
  test('return refunds the service charge in proportion; two part returns add up to the whole charge; cash book gets food plus charge', async () => {
    const o = paid(); const t = build({ over: { 'Order.findOne': o, 'Order.findOneAndUpdate': { ...o, returnedAmount: 100 } } });
    const r = await t.run('post', '/orders/:id/returns', { params: PARAMS, body: { reason: 'cold tea', items: [{ lineIndex: 0, qty: 2 }] } });
    expect(r.status).toBe(200); expect(r.b.data.refund).toBe(100); expect(r.b.data.serviceChargeRefund).toBe(10);
    const upd = t.calls.find((c) => c.model === 'Order' && c.meth === 'findOneAndUpdate'); expect(upd.args[1].$set.serviceChargeRefunded).toBe(10);
    expect(t.calls.some((c) => c.model === 'CashEntry' && c.args[0].type === 'out' && c.args[0].amount === 110)).toBe(true);
    const second = paid({ returnedAmount: 100, returnedQty: [2, 0], serviceChargeRefunded: 10 }); const t2 = build({ over: { 'Order.findOne': second, 'Order.findOneAndUpdate': { ...second, returnedAmount: 200 } } });
    const r2 = await t2.run('post', '/orders/:id/returns', { params: PARAMS, body: { reason: 'wrong dish', items: [{ lineIndex: 1, qty: 2 }] } }); expect(r2.b.data.serviceChargeRefund).toBe(10);
    const none = paid({ serviceCharge: 0 }); const t3 = build({ over: { 'Order.findOne': none, 'Order.findOneAndUpdate': { ...none, returnedAmount: 100 } } });
    expect((await t3.run('post', '/orders/:id/returns', { params: PARAMS, body: { reason: 'cold tea', items: [{ lineIndex: 0, qty: 2 }] } })).b.data.serviceChargeRefund).toBe(0);
  });
  test('return puts food back only when asked: ingredients of the returned dishes go up, in this venue only; a cashier still cannot return', async () => {
    const o = paid(); const over = { 'Order.findOne': o, 'Order.findOneAndUpdate': { ...o, returnedAmount: 100 }, 'Recipe.find': [{ dishKey: 'tea', portion: 1, parts: [{ ingredientId: IID, qty: 5 }] }] };
    const no = build({ over }); const a = await no.run('post', '/orders/:id/returns', { params: PARAMS, body: { reason: 'cold tea', items: [{ lineIndex: 0, qty: 2 }] } });
    expect(a.b.data.restocked).toBe(false); expect(no.calls.some((c) => c.model === 'Ingredient')).toBe(false);
    const yes = build({ over }); const b = await yes.run('post', '/orders/:id/returns', { params: PARAMS, body: { reason: 'cold tea', restock: true, items: [{ lineIndex: 0, qty: 2 }] } });
    expect(b.b.data.restocked).toBe(true); const inc = yes.calls.find((c) => c.model === 'Ingredient' && c.meth === 'updateOne'); expect(inc.args[0].tenantId).toBe(TID); expect(String(inc.args[0]._id)).toBe(IID); expect(inc.args[1].$inc.qty).toBe(10);
    const rc = yes.calls.find((c) => c.model === 'Recipe' && c.meth === 'find'); expect(rc.args[0].tenantId).toBe(TID);
    expect((await build({ over }).run('post', '/orders/:id/returns', { params: PARAMS, user: cashier, body: { reason: 'cold tea', restock: true, items: [{ lineIndex: 0, qty: 2 }] } })).status).toBe(403);
  });
  test('overnight shifts: a 22:00 to 02:00 shift blocks the early hours of the next day and the evening before; back to back is fine; far days are free', () => {
    const night = { date: '2026-11-12', from: '22:00', to: '02:00' };
    expect(PE.overlapsAcrossDays([night], { date: '2026-11-13', from: '01:00', to: '05:00' })).toBe(true); expect(PE.overlapsAcrossDays([night], { date: '2026-11-13', from: '02:00', to: '08:00' })).toBe(false);
    expect(PE.overlapsAcrossDays([{ date: '2026-11-13', from: '01:00', to: '05:00' }], night)).toBe(true); expect(PE.overlapsAcrossDays([night], { date: '2026-11-12', from: '21:00', to: '23:00' })).toBe(true);
    expect(PE.overlapsAcrossDays([night], { date: '2026-11-12', from: '18:00', to: '22:00' })).toBe(false); expect(PE.overlapsAcrossDays([night], { date: '2026-11-14', from: '01:00', to: '05:00' })).toBe(false); expect(PE.overlapsAcrossDays([], night)).toBe(false);
  });
  test('shift route refuses a shift that collides with last night\'s overnight shift, and looks only at this venue and nearby dates', async () => {
    const t = build({ over: { 'User.findOne': { _id: UID2, tenantId: TID }, 'Shift.find': [{ _id: 's1', date: '2026-11-12', from: '22:00', to: '02:00' }] } });
    expect((await t.run('post', '/shifts', { body: { userId: UID2, date: '2026-11-13', from: '01:00', to: '06:00' } })).status).toBe(409);
    const q = t.calls.find((c) => c.model === 'Shift' && c.meth === 'find').args[0]; expect(q.tenantId).toBe(TID); expect(q.date.$gte).toBe('2026-11-12'); expect(q.date.$lte).toBe('2026-11-14');
    const ok = build({ over: { 'User.findOne': { _id: UID2, tenantId: TID }, 'Shift.find': [{ _id: 's1', date: '2026-11-12', from: '22:00', to: '02:00' }], 'Shift.create': { _id: 's2', date: '2026-11-13', from: '02:00', to: '08:00' } } });
    expect((await ok.run('post', '/shifts', { body: { userId: UID2, date: '2026-11-13', from: '02:00', to: '08:00' } })).status).toBe(201);
  });
  test('payslip list for the panel: owner or manager only, this venue only, people without pay set are left out, "prev" means last month', async () => {
    const over = { 'StaffPay.find': [{ userId: UID2, ratePerHour: 0, monthly: 20000 }], 'StaffPay.findOne': { userId: UID2, ratePerHour: 0, monthly: 20000 }, 'User.findOne': { _id: UID2, name: 'Asha', email: 'a@x.in' }, 'Punch.find': [], 'Leave.find': [] };
    const t = build({ over }); const r = await t.run('get', '/payslips', { query: { month: 'prev' } }); expect(r.status).toBe(200); expect(r.b.data.length).toBe(1); expect(r.b.data[0].name).toBe('Asha'); expect(r.b.data[0].month).toBe('2026-10'); expect(r.b.data[0].net).toBe(20000);
    for (const c of t.calls.filter((x) => ['StaffPay', 'User', 'Punch', 'Leave'].includes(x.model) && x.meth !== 'create')) expect(c.args[0].tenantId).toBe(TID);
    expect((await build({ over }).run('get', '/payslips', { user: cashier })).status).toBe(403); expect((await build({ over }).run('get', '/payslips', { user: captain })).status).toBe(403);
    expect((await build({ over: { ...over, 'StaffPay.find': [] } }).run('get', '/payslips')).b.data).toEqual([]);
    expect((await build({ over }).run('get', '/payslips', { query: { month: 'zzz' } })).b.data[0].month).toBe('2026-11');
  });
  test('returns list for the panel: only returns of this venue, newest first, not for a cashier', async () => {
    const o1 = { _id: OID, number: 'D-1', returns: [{ at: '2026-11-10T08:00:00Z', refund: 50, reason: 'cold', serviceChargeRefund: 5 }] }; const o2 = { _id: IID, number: 'D-2', returns: [{ at: '2026-11-12T08:00:00Z', refund: 80, reason: 'wrong', restocked: true }] };
    const t = build({ over: { 'Order.find': [o1, o2] } }); const r = await t.run('get', '/returns'); expect(r.status).toBe(200); expect(r.b.data.map((x) => x.number)).toEqual(['D-2', 'D-1']); expect(r.b.data[0].restocked).toBe(true); expect(r.b.data[1].serviceChargeRefund).toBe(5);
    const q = t.calls.find((c) => c.model === 'Order' && c.meth === 'find').args[0]; expect(q.tenantId).toBe(TID); expect((await build({ over: { 'Order.find': [] } }).run('get', '/returns', { user: cashier })).status).toBe(403);
  });
});
