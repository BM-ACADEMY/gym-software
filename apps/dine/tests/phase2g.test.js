const BD = require('../src/birthdays'); const LR = require('../src/loyaltyRule'); const { build, TID, OID } = require('./p2fake');
const billed = { _id: OID, number: 'D-1', status: 'billed', lines: [{ id: 'l1', itemKey: 'tea', name: 'Tea', qty: 2, unitPrice: 100, status: 'served' }], events: [{ what: 'open' }], grandTotal: 210, createdAt: '2026-11-12T08:00:00Z' };
const on = { _id: TID, venueName: 'Cafe', settings: { loyalty: { enabled: true } } };
const base = { 'Order.findOne': billed, 'Order.findOneAndUpdate': { ...billed, status: 'paid' } };
const manager = { id: 'u', tenantId: TID, role: 'subadmin', staffRole: 'manager' };
describe('loyalty and birthdays (Dine Phase 2)', () => {
  test('loyalty is off until switched on; settings kept inside safe limits', () => {
    expect(LR.normalize(undefined).enabled).toBe(false); expect(LR.normalize({ enabled: true, earnPer100: 500 }).earnPer100).toBe(5); expect(LR.normalize({ enabled: true, maxRedeemShare: 2 }).maxRedeemShare).toBe(0.5);
  });
  test('birthdays: month and day only, next 7 days, soonest first, no do-not-contact or deleted guests, 29 Feb checked', () => {
    expect(BD.validMmdd('03-27')).toBe(true); expect(BD.validMmdd('13-01')).toBe(false); expect(BD.validMmdd('02-30')).toBe(false); expect(BD.validMmdd('1990-03-27')).toBe(false);
    const cs = [{ id: 1, name: 'A', birthday: '11-14' }, { id: 2, name: 'B', birthday: '11-12' }, { id: 3, name: 'C', birthday: '11-30' }, { id: 4, name: 'D', birthday: '11-13', doNotContact: true }, { id: 5, name: 'E', birthday: '11-13', anonymised: true }, { id: 6, name: 'F', birthday: 'bad' }];
    expect(BD.birthdaysSoon(cs, '2026-11-12', 7).map((c) => c.id)).toEqual([2, 1]); expect(BD.birthdaysSoon(cs, '2026-11-12', 30).map((c) => c.id)).toEqual([2, 1, 3]);
    expect(BD.suggestion('Ravi Kumar', 'Cafe', '10% off today.')).toBe('Happy birthday Ravi! From all of us at Cafe. 10% off today. Hope to see you soon.');
  });
  test('pay with loyalty off: no points earned and redeeming is refused', async () => {
    const t = build({ over: base }); const o = await t.run('post', '/orders/:id/pay', { params: { id: OID }, body: { payments: [{ method: 'cash', amount: 210 }], customerPhone: '9876543210' } });
    expect(o.status).toBe(200); expect(o.b.pointsEarned).toBe(0); expect(t.calls.some((c) => c.model === 'Loyalty' && c.meth === 'create')).toBe(false);
    expect((await build({ over: base }).run('post', '/orders/:id/pay', { params: { id: OID }, body: { payments: [{ method: 'cash', amount: 210 }], customerPhone: '9876543210', redeemPoints: 100 } })).status).toBe(400);
  });
  test('pay with loyalty on: points earned on what was paid; redeeming turns points into a payment and writes a negative entry', async () => {
    const earn = build({ over: { ...base, 'Tenant.findById': on } }); const e = await earn.run('post', '/orders/:id/pay', { params: { id: OID }, body: { payments: [{ method: 'cash', amount: 210 }], customerPhone: '9876543210' } });
    expect(e.b.pointsEarned).toBe(10); expect(earn.calls.find((c) => c.model === 'Loyalty' && c.meth === 'create').args[0].points).toBe(10);
    const use = build({ over: { ...base, 'Tenant.findById': on, 'Loyalty.find': [{ points: 120 }] } });
    const u = await use.run('post', '/orders/:id/pay', { params: { id: OID }, body: { payments: [{ method: 'cash', amount: 110 }], customerPhone: '9876543210', redeemPoints: 100 } });
    expect(u.status).toBe(200); const set = use.calls.find((c) => c.model === 'Order' && c.meth === 'findOneAndUpdate').args[1].$set; expect(set.pointsUsed).toBe(100); expect(set.payments.some((p) => p.method === 'loyalty' && p.amount === 100)).toBe(true);
    expect(use.calls.some((c) => c.model === 'Loyalty' && c.meth === 'create' && c.args[0].points === -100 && c.args[0].reason === 'used')).toBe(true);
    const few = build({ over: { ...base, 'Tenant.findById': on, 'Loyalty.find': [{ points: 20 }] } });
    expect((await few.run('post', '/orders/:id/pay', { params: { id: OID }, body: { payments: [{ method: 'cash', amount: 210 }], customerPhone: '9876543210', redeemPoints: 100 } })).status).toBe(400);
    expect((await build({ over: { ...base, 'Tenant.findById': on } }).run('post', '/orders/:id/pay', { params: { id: OID }, body: { payments: [{ method: 'cash', amount: 210 }], redeemPoints: 100 } })).status).toBe(400);
  });
  test('routes: settings saved by owner or manager, balance is the ledger sum, birthday saved as month and day, list is suggest-only', async () => {
    const t = build({ over: { 'Loyalty.find': [{ points: 10, date: '2026-11-01', reason: 'earned' }, { points: -4, date: '2026-11-05', reason: 'used' }], 'Customer.findOneAndUpdate': { _id: 'x' }, 'Customer.find': [{ _id: 'g1', name: 'Ravi Kumar', birthday: '11-14' }] } });
    expect((await t.run('put', '/settings/loyalty', { body: { enabled: true, earnPer100: 4 } })).b.data.earnPer100).toBe(4);
    expect((await t.run('put', '/settings/loyalty', { user: { id: 'u', tenantId: TID, role: 'subadmin', staffRole: 'cashier' }, body: { enabled: true } })).status).toBe(403);
    expect((await t.run('get', '/loyalty/:phone', { params: { phone: '9876543210' } })).b.data.balance).toBe(6); expect((await t.run('get', '/loyalty/:phone', { params: { phone: '12' } })).status).toBe(400);
    expect((await t.run('put', '/customers/:id/birthday', { params: { id: OID }, body: { birthday: '1990-03-27' } })).status).toBe(400); expect((await t.run('put', '/customers/:id/birthday', { params: { id: OID }, body: { birthday: '03-27' } })).status).toBe(200);
    const b = await t.run('get', '/customers/birthdays', { user: manager, query: { days: '7' } }); expect(b.b.data.length).toBe(1); expect(b.b.data[0].message).toContain('Happy birthday Ravi'); expect(b.b.data[0].note).toContain('template');
    expect(t.calls.some((c) => c.meth === 'create' && c.model !== 'Activity' && c.model !== 'Loyalty')).toBe(false);
  });
});
