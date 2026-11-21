// D-30: staff may give discounts; the owner sets the rule and always knows. Spy models, no database.
const { createDineRouter } = require('../src/routes');
const D = require('../src');
const TID = 'a'.repeat(24); const OID = 'c'.repeat(24); const NOW = new Date('2026-11-12T08:00:00Z');
const served = { _id: OID, number: 'D-26-00001', status: 'served', createdAt: NOW, events: [{ what: 'open' }], lines: [{ id: 'l1', itemKey: 'tea', name: 'Tea', qty: 10, unitPrice: 100, gstRate: 5, kind: 'food', station: 'kitchen', status: 'served' }] };
function build(settings) {
  const list = []; const mk = (m) => (p, h) => list.push({ m, p, h }); const calls = [];
  const model = (n, v) => new Proxy({}, { get: (_, meth) => (...args) => { calls.push({ model: n, meth, args }); const r = n === 'Tenant' ? { _id: TID, venueName: 'Cafe', settings } : n === 'Order' && meth === 'findOne' ? served : n === 'Order' && meth === 'findOneAndUpdate' ? { ...served, status: 'billed', events: [] } : {}; return meth === 'find' ? { sort() { return this; }, limit() { return this; }, then: (a) => Promise.resolve([]).then(a) } : Promise.resolve(r); } });
  const M = {}; ['Tenant', 'User', 'MenuItem', 'Order', 'Counter', 'Ingredient', 'Recipe', 'Waste', 'CashEntry', 'DayClose', 'Purchase', 'SupplierPayment', 'Customer', 'Punch', 'Activity'].forEach((n) => { M[n] = model(n); });
  createDineRouter({ express: { Router: () => ({ use() {}, get: mk('get'), post: mk('post'), put: mk('put'), delete: mk('delete') }) }, models: M, protect: 'P', tenantOf: (r) => r.user.tenantId, now: () => NOW });
  const run = async (m, p, staffRole, body) => { const route = list.find((x) => x.m === m && x.p === p); const out = {}; const res = { status(c) { out.c = c; return this; }, json(b) { out.b = b; return this; } }; await route.h({ user: { id: 'u1', tenantId: TID, role: 'admin', staffRole }, body, params: { id: OID }, query: {} }, res); out.status = out.c || 200; return out; };
  return { run, calls };
}
const disc = (value, extra) => ({ discount: { type: 'percent', value, reason: 'regular guest', ...(extra || {}) } });
describe('D-30 discount policy (pure)', () => {
  test('owner never limited; staff default 10 percent; owner_only and any', () => {
    expect(D.discountPolicy.check({ role: 'admin', discount: 900, subtotal: 1000 }).ok).toBe(true);
    expect(D.discountPolicy.check({ role: 'staff', discount: 100, subtotal: 1000 }).ok).toBe(true);
    expect(D.discountPolicy.check({ role: 'staff', discount: 105, subtotal: 1000 }).ok).toBe(false);
    expect(D.discountPolicy.check({ role: 'staff', discount: 500, subtotal: 1000, rule: { staff: 'owner_only' } }).ok).toBe(false);
    expect(D.discountPolicy.check({ role: 'staff', discount: 500, subtotal: 1000, rule: { staff: 'any' } }).ok).toBe(true);
    expect(D.discountRole('owner')).toBe('admin'); expect(D.discountRole('cashier')).toBe('staff');
  });
  test('cashier may discount, kitchen may not', () => { expect(D.can('cashier', 'discount')).toBe(true); expect(D.can('kitchen', 'discount')).toBe(false); });
});
describe('D-30 bill route', () => {
  test('staff within the limit: saved with who and percent, audit line written', async () => {
    const { run, calls } = build({ gstProfile: 'none' });
    const o = await run('post', '/orders/:id/bill', 'cashier', disc(10)); expect(o.status).toBe(200);
    const set = calls.find((c) => c.model === 'Order' && c.meth === 'findOneAndUpdate').args[1].$set;
    expect(set.discount).toBe(100); expect(set.discountBy).toBe('staff'); expect(set.discountPercent).toBe(10); expect(set.discountReason).toBe('regular guest'); expect(set.grandTotal).toBe(900); expect(set.discountById).toBe('u1');
    expect(calls.some((c) => c.model === 'Activity' && c.args[0].action === 'bill.discount' && /10% by staff/.test(c.args[0].ref))).toBe(true);
  });
  test('staff over the limit is refused with the limit in the message and nothing is saved', async () => {
    const { run, calls } = build({ gstProfile: 'none' });
    const o = await run('post', '/orders/:id/bill', 'cashier', disc(11)); expect(o.status).toBe(403); expect(o.b.message).toMatch(/up to 10%/);
    expect(calls.some((c) => c.model === 'Order' && c.meth === 'findOneAndUpdate')).toBe(false);
  });
  test('owner can give any discount; recorded as owner', async () => {
    const { run, calls } = build({ gstProfile: 'none' });
    expect((await run('post', '/orders/:id/bill', 'owner', disc(50))).status).toBe(200);
    expect(calls.find((c) => c.model === 'Order' && c.meth === 'findOneAndUpdate').args[1].$set.discountBy).toBe('owner');
  });
  test('owner rule owner_only blocks staff; a raised limit lets staff through', async () => {
    expect((await build({ discountRule: { staff: 'owner_only' } }).run('post', '/orders/:id/bill', 'manager', disc(1))).status).toBe(403);
    expect((await build({ discountRule: { staff: 'limit', maxPercent: 25 } }).run('post', '/orders/:id/bill', 'manager', disc(20))).status).toBe(200);
  });
  test('a discount needs a reason and a sensible value; a role without the permission is refused', async () => {
    const { run } = build({});
    expect((await run('post', '/orders/:id/bill', 'owner', disc(5, { reason: '' }))).status).toBe(400);
    expect((await run('post', '/orders/:id/bill', 'owner', disc(0))).status).toBe(400);
    expect((await run('post', '/orders/:id/bill', 'owner', disc(150))).status).toBe(400);
    expect((await run('post', '/orders/:id/bill', 'owner', { discount: { type: 'amount', value: 10.5, reason: 'abc' } })).status).toBe(400);
    expect((await run('post', '/orders/:id/bill', 'bartender', disc(5))).status).toBe(403);
  });
  test('bill with no discount clears discount fields', async () => {
    const { run, calls } = build({}); await run('post', '/orders/:id/bill', 'cashier', {});
    const set = calls.find((c) => c.model === 'Order' && c.meth === 'findOneAndUpdate').args[1].$set; expect(set.discount).toBe(0); expect(set.discountBy).toBe(null);
  });
});
describe('D-30 settings and owner summary', () => {
  test('only the owner changes the rule; it is cleaned before saving', async () => {
    const { run, calls } = build({});
    expect((await run('put', '/settings', 'manager', { discountRule: { staff: 'any' } })).status).toBe(403);
    expect((await run('put', '/settings', 'owner', { discountRule: { staff: 'bogus', maxPercent: 500 } })).status).toBe(200);
    expect(calls.find((c) => c.model === 'Tenant' && c.meth === 'updateOne').args[1].$set['settings.discountRule']).toEqual({ staff: 'limit', maxPercent: 10 });
  });
  test('daily summary shows a staff-discount line with the first action; owner discounts do not', () => {
    const bills = [{ date: '2026-11-12', total: 900, subtotal: 1000, discount: 100, discountBy: 'staff' }, { date: '2026-11-12', total: 500, subtotal: 600, discount: 100, discountBy: 'owner' }];
    const s = D.dailySummary({ date: '2026-11-12', bills, venue: 'Cafe' });
    expect(s.staffDiscounts).toEqual([{ code: 'staff_discount', count: 1, total: 100, reason: 'Staff gave 1 discount worth Rs 100 today. Each has a reason on its bill.' }]);
    expect(s.actions[0].what).toMatch(/discounts your staff gave/);
    expect(D.dailySummary({ date: '2026-11-12', bills: [bills[1]], venue: 'Cafe' }).staffDiscounts).toEqual([]);
  });
  test('orderToBill carries who gave the discount', () => {
    expect(D.orderToBill({ number: 'x', createdAt: '2026-11-12T08:00:00Z', grandTotal: 1, discountBy: 'staff', discountReason: 'r' }).discountBy).toBe('staff');
  });
});
