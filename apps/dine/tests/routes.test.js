// Route tests with spy models (no database): every route checks the role, and every query it runs carries the venue's tenantId.
// The real-database run is a Dev A item (tests/dineRoutes.db.test.js is NOT written; see the report).
const { createDineRouter } = require('../src/routes');
const D = require('../src');
const TID = 'a'.repeat(24); const OTHER = 'b'.repeat(24); const OID = 'c'.repeat(24);
const NOW = new Date('2026-11-12T08:00:00Z');

function fakeRouter() { const r = { list: [] }; const mk = (m) => (p, h) => r.list.push({ m, p, h }); return { r, router: { use() {}, get: mk('get'), post: mk('post'), put: mk('put'), delete: mk('delete') } }; }
function Q(v) { const q = { sort: () => q, limit: () => q, select: () => q, then: (a, b) => Promise.resolve(v).then(a, b) }; return q; }
function mkModels(over = {}) {
  const calls = []; const M = {};
  const names = ['Tenant', 'User', 'MenuItem', 'Order', 'Counter', 'Ingredient', 'Recipe', 'Waste', 'CashEntry', 'DayClose', 'Purchase', 'SupplierPayment', 'Customer', 'Punch', 'Activity', 'Credit', 'Loyalty', 'Shift', 'Leave', 'StaffPay'];
  const item = { _id: 'i1', key: 'tea', name: 'Tea', price: 100, gstRate: 5, kind: 'food', station: 'kitchen', variants: [], groups: [], isActive: true };
  const order = (status) => ({ _id: OID, number: 'D-26-00001', type: 'dine_in', table: 'T1', status, lines: status === 'open' ? [] : [{ id: 'l1', itemKey: 'tea', name: 'Tea', qty: 2, unitPrice: 100, gstRate: 5, kind: 'food', station: 'kitchen', status: status === 'billed' ? 'served' : 'new' }], events: [{ at: NOW.toISOString(), what: 'open' }], grandTotal: 210, totals: { lines: [] }, createdAt: NOW, paidAt: NOW });
  const dflt = { 'Tenant.findById': { _id: TID, venueName: 'Cafe', settings: { gstProfile: 'per_item', serviceChargePct: 0, pubMode: false } }, 'MenuItem.findOne': item, 'Order.findOne': order('open'), 'Order.findOneAndUpdate': order('sent'), 'Order.create': order('open'), 'Counter.findOneAndUpdate': { seq: 1 }, 'Ingredient.findOne': { _id: 'd'.repeat(24) }, 'Ingredient.find': [{ _id: 'd'.repeat(24), name: 'Rice', qty: 5, costPerUnit: 1 }], 'MenuItem.create': item, 'Ingredient.create': { _id: 'x' }, 'Waste.create': { _id: 'x' }, 'CashEntry.create': { _id: 'x' }, 'Purchase.create': { _id: 'x' }, 'SupplierPayment.create': { _id: 'x' }, 'Punch.create': { _id: 'x' }, 'Activity.create': { _id: 'x' }, 'DayClose.findOneAndUpdate': { _id: 'x' }, 'Recipe.findOneAndUpdate': { _id: 'x' }, 'MenuItem.findOneAndUpdate': item, 'Order.countDocuments': 0 };
  for (const n of names) {
    M[n] = {};
    for (const meth of ['find', 'findOne', 'findById', 'findOneAndUpdate', 'updateOne', 'countDocuments', 'create']) {
      M[n][meth] = (...args) => { calls.push({ model: n, meth, args }); const k = n + '.' + meth; const v = k in over ? over[k] : k in dflt ? dflt[k] : (meth === 'find' ? [] : meth === 'countDocuments' ? 0 : null); return meth === 'find' ? Q(v) : Promise.resolve(typeof v === 'function' ? v(...args) : v); };
    }
  }
  return { M, calls };
}
function build({ over, role = 'owner', planOf, guardWrite } = {}) {
  const { r, router } = fakeRouter(); const { M, calls } = mkModels(over);
  createDineRouter({ express: { Router: () => router }, models: M, protect: 'P', tenantOf: (req) => req.user.tenantId, planOf, guardWrite, now: () => NOW });
  const run = async (m, p, { body, params, query, user } = {}) => {
    const route = r.list.find((x) => x.m === m && x.p === p); if (!route) throw new Error('no route ' + m + ' ' + p);
    const out = { h: {} }; const res = { set(k, v) { out.h[k] = v; return this; }, status(c) { out.c = c; return this; }, json(b) { out.b = b; return this; }, send(b) { out.text = b; return this; } };
    await route.h({ user: user || { id: 'u1', tenantId: TID, role: 'admin', staffRole: role }, body: body || {}, params: params || {}, query: query || {} }, res); out.status = out.c || 200; return out;
  };
  return { r, run, calls, M };
}
const BODY = { 'post /menu': { key: 'tea', name: 'Tea', price: 100 }, 'put /menu/:key': { name: 'Tea', price: 120 }, 'post /orders': { type: 'dine_in', table: 'T1' }, 'post /orders/:id/lines': { itemKey: 'tea', qty: 1 }, 'post /orders/:id/lines/:lineId/void': { reason: 'guest left' }, 'post /orders/:id/reopen': { reason: 'guest adds tea' }, 'post /orders/:id/split': { mode: 'equal', guests: 2 }, 'post /orders/:id/pay': { payments: [{ method: 'cash', amount: 210 }] }, 'post /ingredients': { name: 'Rice', costPerUnit: 1 }, 'put /recipes/:dishKey': { parts: [{ ingredientId: 'd'.repeat(24), qty: 5 }] }, 'post /waste': { ingredientId: 'd'.repeat(24), qty: 1, reason: 'spoiled' }, 'post /cash': { type: 'out', amount: 100 }, 'post /day-close': { opening: 0, counted: 100 }, 'post /purchases': { supplier: 'A', date: '2026-11-01', amount: 100 }, 'post /supplier-payments': { supplier: 'A', date: '2026-11-02', amount: 50 }, 'post /punch': { kind: 'in' }, 'put /settings': { serviceChargePct: 5 } };
const PARAMS = { id: OID, key: 'tea', lineId: 'l1', dishKey: 'tea' };
const PERM_DENIED_ROLE = 'nobody'; // a role that has no permission at all

describe('Dine routes', () => {
  test('every route refuses a role with no permission and touches the database not at all', async () => {
    const { r, run, calls } = build({ role: PERM_DENIED_ROLE });
    expect(r.list.length > 30).toBe(true);
    for (const x of r.list) { const o = await run(x.m, x.p, { body: BODY[x.m + ' ' + x.p], params: PARAMS, user: { id: 'u', tenantId: TID, role: 'admin', staffRole: PERM_DENIED_ROLE } }); expect(o.status).toBe(403); }
    expect(calls.length).toBe(0);
  });
  test('every query on every route carries the venue tenantId, and never another one', async () => {
    const { r, run, calls } = build();
    for (const x of r.list) await run(x.m, x.p, { body: BODY[x.m + ' ' + x.p], params: PARAMS, query: { from: '2026-11-01', to: '2026-11-12' } });
    expect(calls.length > 40).toBe(true);
    for (const c of calls) {
      if (c.model === 'Tenant') continue; // the venue record itself, found by its own id
      if (c.meth === 'create') { expect(String(c.args[0].tenantId)).toBe(TID); continue; }
      expect(String((c.args[0] || {}).tenantId)).toBe(TID);
    }
    expect(JSON.stringify(calls).indexOf(OTHER)).toBe(-1);
  });
  test('a different venue user gets that venue id in every query (tenant is read from the session, never from the request)', async () => {
    const { r, run, calls } = build();
    await run('get', '/orders', { user: { id: 'u2', tenantId: OTHER, role: 'admin', staffRole: 'owner' }, query: { tenantId: TID } });
    expect(calls.length).toBe(1); expect(String(calls[0].args[0].tenantId)).toBe(OTHER);
  });
  test('kitchen role can see the kitchen screen but cannot add orders or see reports', async () => {
    const { run } = build();
    const u = { id: 'u', tenantId: TID, role: 'subadmin', staffRole: 'kitchen' };
    expect((await run('get', '/kitchen', { user: u })).status).toBe(200);
    expect((await run('post', '/orders', { user: u, body: { table: 'T1' } })).status).toBe(403);
    expect((await run('get', '/reports/sales', { user: u })).status).toBe(403);
  });
  test('kitchen board tells the screen when the newest ticket was sent, and keeps to the chosen station', async () => {
    const sentAt = '2026-11-13T10:00:00.000Z';
    const row = { _id: OID, number: 'D-1', type: 'takeaway', table: '', status: 'sent', events: [{ at: '2026-11-13T09:00:00.000Z', what: 'kot' }, { at: sentAt, what: 'kot' }, { at: '2026-11-13T10:05:00.000Z', what: 'served' }], lines: [{ id: 'l1', name: 'Tea', qty: 1, status: 'sent', station: 'kitchen' }, { id: 'l2', name: 'Beer', qty: 1, status: 'sent', station: 'bar' }] };
    const { run } = build({ over: { 'Order.find': [row] } });
    const k = await run('get', '/kitchen', { query: {} });
    expect(k.b.data).toHaveLength(1); expect(k.b.data[0].sentAt).toBe(sentAt); expect(k.b.data[0].type).toBe('takeaway'); expect(k.b.data[0].lines.map((l) => l.name)).toEqual(['Tea']);
    const b = await run('get', '/kitchen', { query: { station: 'bar' } });
    expect(b.b.data[0].lines.map((l) => l.name)).toEqual(['Beer']);
  });
  test('cashier can bill but not void; a void needs a reason and is logged', async () => {
    const { run, calls } = build({ over: { 'Order.findOne': { _id: OID, number: 'D-1', status: 'sent', lines: [{ id: 'l1', name: 'Tea', qty: 1, unitPrice: 100, status: 'sent' }], events: [{ what: 'open' }] }, 'Order.findOneAndUpdate': { _id: OID, status: 'sent', lines: [], events: [] } } });
    const cashier = { id: 'u', tenantId: TID, role: 'subadmin', staffRole: 'cashier' };
    expect((await run('post', '/orders/:id/lines/:lineId/void', { user: cashier, params: PARAMS, body: { reason: 'abc' } })).status).toBe(403);
    expect((await run('post', '/orders/:id/lines/:lineId/void', { params: PARAMS, body: {} })).status).toBe(400);
    expect((await run('post', '/orders/:id/lines/:lineId/void', { params: PARAMS, body: { reason: 'guest left' } })).status).toBe(200);
    expect(calls.some((c) => c.model === 'Activity' && c.meth === 'create' && c.args[0].action === 'order.void')).toBe(true);
  });
  test('a bad order id is a 404 and runs no query', async () => {
    const { run, calls } = build();
    expect((await run('get', '/orders/:id', { params: { id: '{"$ne":1}' } })).status).toBe(404); expect(calls.length).toBe(0);
  });
  test('adding a line: price and station come from the menu, never from the request', async () => {
    const { run, calls } = build();
    const o = await run('post', '/orders/:id/lines', { params: PARAMS, body: { itemKey: 'tea', qty: 2, unitPrice: 1 } });
    expect(o.status).toBe(201);
    const upd = calls.find((c) => c.model === 'Order' && c.meth === 'findOneAndUpdate');
    const line = upd.args[1].$set.lines[0]; expect(line.unitPrice).toBe(100); expect(line.qty).toBe(2); expect(line.station).toBe('kitchen'); expect(line.status).toBe('new');
    expect(upd.args[0].events.$size).toBe(1); // optimistic lock on the events count
  });
  test('two people changing one order: the second save is refused', async () => {
    const { run } = build({ over: { 'Order.findOneAndUpdate': null } });
    const o = await run('post', '/orders/:id/lines', { params: PARAMS, body: { itemKey: 'tea', qty: 1 } });
    expect(o.status).toBe(400); expect(o.b.message).toMatch(/Someone else/);
  });
  test('alcohol items, bar tabs and time offers are refused until pub mode is on; pub mode is a plan feature', async () => {
    const { run } = build();
    expect((await run('post', '/menu', { body: { key: 'beer', name: 'Beer', price: 200, kind: 'liquor' } })).status).toBe(403);
    expect((await run('post', '/orders', { body: { type: 'bar' } })).status).toBe(403);
    expect((await run('put', '/settings', { body: { happyRules: [{ label: 'HH', days: [1], from: '16:00', to: '19:00', type: 'percent_off', value: 20 }] } })).status).toBe(403);
    expect((await run('put', '/settings', { body: { pubMode: true } })).status).toBe(403); // no planOf: not allowed
    const pro = build({ planOf: () => 'pro' }); expect((await pro.run('put', '/settings', { body: { pubMode: true } })).status).toBe(200);
    const starter = build({ planOf: () => 'starter' }); expect((await starter.run('put', '/settings', { body: { pubMode: true } })).status).toBe(403);
  });
  test('bill: totals stored with GST per profile, service charge added, note says GST profile is unconfirmed', async () => {
    const billed = { _id: OID, number: 'D-1', status: 'served', lines: [{ id: 'l1', itemKey: 'tea', name: 'Tea', qty: 2, unitPrice: 100, gstRate: 5, kind: 'food', station: 'kitchen', status: 'served' }], events: [{ what: 'open' }], createdAt: NOW };
    const { run, calls } = build({ over: { 'Order.findOne': billed, 'Order.findOneAndUpdate': { ...billed, status: 'billed' }, 'Tenant.findById': { _id: TID, venueName: 'Cafe', settings: { gstProfile: 'per_item', serviceChargePct: 10 } } } });
    const o = await run('post', '/orders/:id/bill', { params: PARAMS });
    expect(o.status).toBe(200); expect(o.b.note).toMatch(/not yet confirmed/);
    const set = calls.find((c) => c.model === 'Order' && c.meth === 'findOneAndUpdate').args[1].$set;
    expect(set.status).toBe('billed'); expect(set.serviceCharge).toBe(20); expect(set.totals.gst).toBe(10); expect(set.grandTotal).toBe(230);
  });
  test('pay: short payment refused; already-paid refused; good payment takes recipe stock off and records the visit', async () => {
    const billed = { _id: OID, number: 'D-1', status: 'billed', lines: [{ id: 'l1', itemKey: 'tea', name: 'Tea', qty: 2, unitPrice: 100, status: 'served' }], events: [{ what: 'open' }], grandTotal: 210, createdAt: NOW };
    const ing = 'd'.repeat(24);
    const mk = (over) => build({ over: { 'Order.findOne': billed, 'Order.findOneAndUpdate': { ...billed, status: 'paid' }, 'Recipe.find': [{ dishKey: 'tea', portion: 1, parts: [{ ingredientId: ing, qty: 10 }] }], ...(over || {}) } });
    expect((await mk().run('post', '/orders/:id/pay', { params: PARAMS, body: { payments: [{ method: 'cash', amount: 100 }] } })).status).toBe(400);
    expect((await mk().run('post', '/orders/:id/pay', { params: PARAMS, body: { payments: [{ method: 'credit', amount: 210 }] } })).status).toBe(400);
    expect((await mk({ 'Order.findOneAndUpdate': null }).run('post', '/orders/:id/pay', { params: PARAMS, body: { payments: [{ method: 'upi', amount: 210 }] } })).status).toBe(409);
    const ok = mk(); const o = await ok.run('post', '/orders/:id/pay', { params: PARAMS, body: { payments: [{ method: 'cash', amount: 500 }], customerPhone: '9876543210', customerName: 'Ravi' } });
    expect(o.status).toBe(200); expect(o.b.change).toBe(290);
    const inc = ok.calls.find((c) => c.model === 'Ingredient' && c.meth === 'updateOne'); expect(inc.args[1].$inc.qty).toBe(-20); expect(String(inc.args[0].tenantId)).toBe(TID);
    expect(ok.calls.some((c) => c.model === 'Customer')).toBe(true);
    const guard = ok.calls.find((c) => c.model === 'Order' && c.meth === 'findOneAndUpdate').args[0]; expect(guard.status).toBe('billed');
  });
  test('open-order limit of the plan is enforced', async () => {
    const { run } = build({ planOf: () => 'starter', over: { 'Order.countDocuments': 10 } });
    expect((await run('post', '/orders', { body: { table: 'T1' } })).status).toBe(429);
  });
  test('read-only account (trial over, unpaid) is blocked before any route runs', () => {
    const { r } = fakeRouter(); const mw = []; let used = [];
    createDineRouter({ express: { Router: () => ({ use: (...a) => used.push(a), get() {}, post() {}, put() {}, delete() {} }) }, models: mkModels().M, protect: 'P', tenantOf: () => TID, guardWrite: () => ({ ok: false, httpStatus: 402, message: 'Plan ended' }) });
    let out; used[1][0]({ method: 'POST' }, { status: (c) => ({ json: (b) => { out = { c, b }; } }) }, () => { out = 'next'; }); expect(out.c).toBe(402);
  });
  test('sales report, GST summary and CA export read only this venue and the export is logged', async () => {
    const { run, calls } = build();
    expect((await run('get', '/reports/sales', { query: { by: 'item', from: '2026-11-01', to: '2026-11-12' } })).status).toBe(200);
    const ex = await run('get', '/export/ca.csv', { query: { from: '2026-11-01', to: '2026-11-12' } });
    expect(ex.h['Content-Type']).toMatch(/csv/); expect(ex.text).toMatch(/^Date,Bill no/);
    expect(calls.some((c) => c.model === 'Activity' && c.args[0].action === 'export.ca')).toBe(true);
  });
  test('daily summary runs end to end on an empty day and says it only suggests', async () => {
    const { run } = build(); const o = await run('get', '/summary/daily', { query: { date: '2026-11-12' } });
    expect(o.status).toBe(200); expect(o.b.data.mode).toBe('suggest'); expect(o.b.data.actions).toEqual([]);
  });
  test('predictions on an empty venue are honest: each says what data it needs', async () => {
    const { run } = build(); const o = await run('get', '/predictions'); const p = o.b.data;
    expect(p.salesNextMonth.range).toBe(null); expect(p.salesNextMonth.reason).toMatch(/Needs at least 3/); expect(p.busyDays.days).toBe(null);
  });
});
