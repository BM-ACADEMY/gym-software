const { fakeMongoose, fakeRouter, call } = require('./fake');
const { createSalonRouter, createPublicRouter, makeLimiter } = require('../src/routes');
const makeModels = require('../src/models'); const B = require('../src/booking');
const fs = require('fs'); const path = require('path');

const ownerOf = (tid) => ({ user: { id: 'u' + tid, tenantId: tid, role: 'admin' } });
const staffOf = (tid, staffId) => ({ user: { id: 's' + tid, tenantId: tid, role: 'staff', staffId } });
// Next open weekday (Mon to Sat) at least 2 days ahead, so "past time today" never interferes.
const openDay = () => { let d = B.addDays(B.istParts().date, 2); while (B.weekday(d) === 0) d = B.addDays(d, 1); return d; };
async function setup() {
  const { mongoose } = fakeMongoose(); const ex = { Router: () => fakeRouter() };
  const router = createSalonRouter({ express: ex, mongoose, protect: (q, s, n) => n(), authorize: () => (q, s, n) => n(), tenantOf: (r) => r.user.tenantId });
  const pub = createPublicRouter({ express: ex, mongoose, limiter: makeLimiter({ max: 5 }) });
  const M = makeModels(mongoose);
  const mkTenant = async (name) => { const t = await M.Tenant.create({ businessName: name, bookingToken: (name.charCodeAt(0).toString(16).padStart(2, '0')).repeat(24), windows: [[600, 780], [1080, 1260]], closedWeekdays: [0], slotStep: 30, bufferMins: 0, bookingMode: 'instant', taxMode: 'none' }); const id = String(t._id); const st = await M.Staff.create({ tenantId: id, name: name + ' stylist', serviceKeys: [] }); await M.Service.create({ tenantId: id, key: 'haircut', name: 'Haircut', mins: 30, price: 500, gstRate: 0 }); return { id, staffId: String(st._id), token: t.bookingToken }; };
  return { router, pub, M, A: await mkTenant('Alpha'), Bt: await mkTenant('Bravo') };
}
describe('Salon routes: bookings', () => {
  test('owner books, the same slot cannot be booked twice, a cancelled slot opens again', async () => {
    const s = await setup(); const day = openDay();
    const body = { date: day, start: 600, staffId: s.A.staffId, serviceKey: 'haircut', name: 'Ravi', phone: '9840012210' };
    const a = await call(s.router, 'POST', '/appointments', { ...ownerOf(s.A.id), body }); expect(a.code).toBe(201);
    const b = await call(s.router, 'POST', '/appointments', { ...ownerOf(s.A.id), body: { ...body, name: 'Other', phone: '9944551872' } }); expect(b.code).toBe(409);
    const slots = await call(s.router, 'GET', '/slots', { ...ownerOf(s.A.id), query: { date: day, staffId: s.A.staffId, serviceKey: 'haircut' } });
    expect(slots.body.data.slots.includes(600)).toBe(false); expect(slots.body.data.slots.includes(630)).toBe(true);
    const c = await call(s.router, 'POST', '/appointments/:id/cancel', { ...ownerOf(s.A.id), params: { id: a.body.data.id } }); expect(c.code).toBe(200);
    expect((await call(s.router, 'POST', '/appointments', { ...ownerOf(s.A.id), body: { ...body, name: 'Other', phone: '9944551872' } })).code).toBe(201);
  });
  test('bad input is refused with a plain message: bad phone, past date, Sunday, outside hours', async () => {
    const s = await setup(); const day = openDay(); const base = { date: day, start: 600, staffId: s.A.staffId, serviceKey: 'haircut', name: 'Ravi', phone: '9840012210' };
    const go = (patch) => call(s.router, 'POST', '/appointments', { ...ownerOf(s.A.id), body: { ...base, ...patch } });
    expect((await go({ phone: '123' })).code).toBe(400);
    expect((await go({ date: B.addDays(B.istParts().date, -3) })).code).toBe(400);
    let sun = B.addDays(B.istParts().date, 3); while (B.weekday(sun) !== 0) sun = B.addDays(sun, 1); expect((await go({ date: sun })).code).toBe(400);
    expect((await go({ start: 900 })).code).toBe(400);
    expect((await go({ date: B.addDays(B.istParts().date, 200) })).code).toBe(400);
  });
  test('tenant isolation: another business sees nothing, cannot cancel, mark, read or reschedule', async () => {
    const s = await setup(); const day = openDay();
    const a = await call(s.router, 'POST', '/appointments', { ...ownerOf(s.A.id), body: { date: day, start: 600, staffId: s.A.staffId, serviceKey: 'haircut', name: 'Ravi', phone: '9840012210' } });
    const id = a.body.data.id;
    expect((await call(s.router, 'GET', '/appointments', { ...ownerOf(s.Bt.id), query: { date: day } })).body.data.length).toBe(0);
    for (const p of ['cancel', 'done', 'noshow', 'reschedule']) expect((await call(s.router, 'POST', '/appointments/:id/' + p, { ...ownerOf(s.Bt.id), params: { id }, body: { date: day, start: 630 } })).code).toBe(404);
    expect((await call(s.router, 'GET', '/customers', ownerOf(s.Bt.id))).body.data.length).toBe(0);
    expect((await call(s.router, 'GET', '/customers', ownerOf(s.A.id))).body.data.length).toBe(1);
    const cid = (await call(s.router, 'GET', '/customers', ownerOf(s.A.id))).body.data[0].id;
    expect((await call(s.router, 'GET', '/customers/:id', { ...ownerOf(s.Bt.id), params: { id: cid } })).code).toBe(404);
    // booking with another business's staff member fails too
    expect((await call(s.router, 'POST', '/appointments', { ...ownerOf(s.Bt.id), body: { date: day, start: 660, staffId: s.A.staffId, serviceKey: 'haircut', name: 'X Y', phone: '9840012211' } })).code).toBe(400);
  });
  test('staff login sees masked phones and only their own visits', async () => {
    const s = await setup(); const day = openDay();
    await call(s.router, 'POST', '/appointments', { ...ownerOf(s.A.id), body: { date: day, start: 600, staffId: s.A.staffId, serviceKey: 'haircut', name: 'Ravi', phone: '9840012210' } });
    const other = await call(s.router, 'POST', '/staff', { ...ownerOf(s.A.id), body: { name: 'Second' } });
    const mine = await call(s.router, 'GET', '/appointments', { ...staffOf(s.A.id, other.body.data.id), query: { date: day } }); expect(mine.body.data.length).toBe(0);
    const own = await call(s.router, 'GET', '/appointments', { ...staffOf(s.A.id, s.A.staffId), query: { date: day } }); expect(own.body.data[0].customer.phone).toBe('98******10');
    expect((await call(s.router, 'GET', '/customers', staffOf(s.A.id, s.A.staffId))).body.data[0].phone).toBe('98******10');
  });
  test('done updates the customer; pending needs the owner to accept; staff cannot accept', async () => {
    const s = await setup(); const day = openDay(); const M = s.M;
    const a = await call(s.router, 'POST', '/appointments', { ...ownerOf(s.A.id), body: { date: day, start: 600, staffId: s.A.staffId, serviceKey: 'haircut', name: 'Ravi', phone: '9840012210' } });
    expect((await call(s.router, 'POST', '/appointments/:id/done', { ...ownerOf(s.A.id), params: { id: a.body.data.id } })).code).toBe(200);
    expect((await M.Customer.findOne({ tenantId: s.A.id, phone: '9840012210' })).lastServiceKey).toBe('haircut');
    expect((await call(s.router, 'POST', '/appointments/:id/done', { ...ownerOf(s.A.id), params: { id: a.body.data.id } })).code).toBe(409);
  });
});
describe('Salon public booking link', () => {
  test('token only, consent required, only offered slots, one winner per slot, other business untouched', async () => {
    const s = await setup(); const day = openDay();
    expect((await call(s.pub, 'GET', '/:token', { params: { token: 'z'.repeat(48) } })).code).toBe(404);
    expect((await call(s.pub, 'GET', '/:token', { params: { token: 'bad' } })).code).toBe(404);
    const page = await call(s.pub, 'GET', '/:token', { params: { token: s.A.token } }); expect(page.body.data.businessName).toBe('Alpha'); expect(page.body.data.services.length).toBe(1);
    const book = (patch, token = s.A.token) => call(s.pub, 'POST', '/:token/book', { params: { token }, body: { date: day, start: 600, staffId: s.A.staffId, serviceKey: 'haircut', name: 'Ravi', phone: '9840012210', consent: true, ...patch } });
    expect((await book({ consent: false })).code).toBe(400);
    expect((await book({ start: 605 })).code).toBe(409);
    const ok = await book({}); expect(ok.code).toBe(201); expect(ok.body.data.status).toBe('booked');
    expect((await book({ name: 'Two Person', phone: '9944551872' })).code).toBe(409);
    expect((await book({}, s.Bt.token)).code).toBe(400); // A's staff member on B's link
    expect((await book({ staffId: s.Bt.staffId, phone: '9840012299' }, s.Bt.token)).code).toBe(201);
    expect(JSON.stringify(ok.body)).toBe(JSON.stringify(ok.body)); expect(ok.body.data.phone).toBe(undefined);
  });
  test('approve mode holds the slot as pending; a customer can cancel only with their own phone; rate limit stops floods', async () => {
    const s = await setup(); const day = openDay();
    await s.M.Tenant.updateOne({ _id: s.A.id }, { $set: { bookingMode: 'approve' } });
    const ok = await call(s.pub, 'POST', '/:token/book', { params: { token: s.A.token }, body: { date: day, start: 600, staffId: s.A.staffId, serviceKey: 'haircut', name: 'Ravi', phone: '9840012210', consent: true } });
    expect(ok.body.data.status).toBe('pending');
    const id = ok.body.data.id;
    expect((await call(s.pub, 'POST', '/:token/appointments/:id/cancel', { params: { token: s.A.token, id }, body: { phone: '9000000000' } })).code).toBe(404);
    expect((await call(s.pub, 'POST', '/:token/appointments/:id/cancel', { params: { token: s.Bt.token, id }, body: { phone: '9840012210' } })).code).toBe(404);
    let last; for (let i = 0; i < 6; i++) last = await call(s.pub, 'GET', '/:token', { params: { token: s.A.token } }); expect(last.code).toBe(429);
  });
  test('limiter window and size', () => {
    let t = 0; const l = makeLimiter({ max: 2, windowMs: 1000, now: () => t });
    expect(l.allow('k')).toBe(true); expect(l.allow('k')).toBe(true); expect(l.allow('k')).toBe(false); t = 1500; expect(l.allow('k')).toBe(true); expect(l.allow('j')).toBe(true);
  });
});
describe('Salon routes: bills and commission', () => {
  test('bill uses server prices, counts commission, needs a reason for a discount, is safe to retry', async () => {
    const s = await setup(); const o = ownerOf(s.A.id);
    await call(s.router, 'PUT', '/settings', { ...o, body: { commissionRules: { default: { type: 'percent', value: 40 } }, taxMode: 'none' } });
    const b = { clientId: 'dev-1', lines: [{ serviceKey: 'haircut', staffId: s.A.staffId, unitPrice: 1 }], payments: [{ method: 'cash', amount: 500 }] };
    const r = await call(s.router, 'POST', '/bills', { ...o, body: b }); expect(r.code).toBe(201); expect(r.body.data.total).toBe(500); expect(r.body.data.commissions[s.A.staffId]).toBe(200); expect(r.body.data.status).toBe('paid');
    const again = await call(s.router, 'POST', '/bills', { ...o, body: b }); expect(again.body.duplicate).toBe(true);
    const noReason = await call(s.router, 'POST', '/bills', { ...o, body: { lines: b.lines, billDiscount: { type: 'percent', value: 50 }, payments: [] } }); expect(noReason.code).toBe(400);
    const withReason = await call(s.router, 'POST', '/bills', { ...o, body: { lines: b.lines, billDiscount: { type: 'percent', value: 50 }, discountReason: 'Regular customer', payments: [{ method: 'upi', amount: 250 }] } }); expect(withReason.body.data.total).toBe(250);
    expect((await call(s.router, 'POST', '/bills', { ...o, body: { lines: [{ serviceKey: 'haircut', staffId: s.Bt.staffId }], payments: [] } })).code).toBe(400); // other business's staff
    expect((await call(s.router, 'GET', '/bills', ownerOf(s.Bt.id))).body.data.length).toBe(0);
    const c = await call(s.router, 'GET', '/commission', { ...o, query: { from: B.istParts().date, to: B.istParts().date } }); expect(c.body.data.totals[s.A.staffId]).toBe(300);
  });
});
describe('Salon routes: accounts, day close, estimates', () => {
  test('expense, unpaid due, day close difference, P&L and CSV export', async () => {
    const s = await setup(); const o = ownerOf(s.A.id); const t = B.istParts().date;
    await call(s.router, 'POST', '/bills', { ...o, body: { lines: [{ serviceKey: 'haircut', staffId: s.A.staffId }], payments: [{ method: 'cash', amount: 500 }] } });
    expect((await call(s.router, 'POST', '/expenses', { ...o, body: { amount: 100, category: 'products', paidTo: '=cmd', method: 'cash' } })).code).toBe(201);
    expect((await call(s.router, 'POST', '/expenses', { ...o, body: { amount: 3000, category: 'rent', paid: false } })).code).toBe(400);
    expect((await call(s.router, 'POST', '/expenses', { ...o, body: { amount: 3000, category: 'rent', paid: false, dueDate: B.addDays(t, 5) } })).code).toBe(201);
    const dues = await call(s.router, 'GET', '/dues', o); expect(dues.body.data.supplierDues.length).toBe(1); expect(dues.body.data.cashNeededNext14Days.amount).toBe(3000);
    const dc = await call(s.router, 'POST', '/day-close', { ...o, body: { openingCash: 1000, countedCash: 1350 } }); expect(dc.body.data.difference).toBe(-50); expect(dc.body.data.text).toMatch(/short by Rs 50/);
    const pnl = await call(s.router, 'GET', '/accounts/pnl', { ...o, query: { from: t, to: t } }); expect(pnl.body.data.income).toBe(500); expect(pnl.body.data.expenseTotal).toBe(3100);
    const csv = await call(s.router, 'GET', '/accounts/export.csv', { ...o, query: { from: t, to: t } }); expect(csv.headers['Content-Type']).toMatch(/csv/); expect(csv.body).toMatch(/'=cmd/);
    expect((await call(s.router, 'GET', '/accounts/pnl', { ...ownerOf(s.Bt.id), query: { from: t, to: t } })).body.data.income).toBe(0);
    expect((await call(s.router, 'GET', '/accounts/pnl', { ...o, query: { from: t, to: '2000-01-01' } })).code).toBe(400);
    const al = await call(s.router, 'GET', '/alerts', o); expect(al.body.data.items.some((i) => i.kind === 'cash')).toBe(true);
  });
  test('summary, win-back list and predictions are suggestions only and respect consent', async () => {
    const s = await setup(); const o = ownerOf(s.A.id); const M = s.M; const t = B.istParts().date;
    await M.Customer.create({ tenantId: s.A.id, name: 'Agreed', phone: '9840012210', lastVisit: B.addDays(t, -90), lastServiceKey: 'haircut', consent: { at: new Date() } });
    await M.Customer.create({ tenantId: s.A.id, name: 'Never agreed', phone: '9944551872', lastVisit: B.addDays(t, -90), lastServiceKey: 'haircut' });
    await M.Customer.create({ tenantId: s.Bt.id, name: 'Other business', phone: '9840099999', lastVisit: B.addDays(t, -90), lastServiceKey: 'haircut', consent: { at: new Date() } });
    const w = await call(s.router, 'GET', '/lists/winback', o); expect(w.body.data.lapsed.map((x) => x.name)).toEqual(['Agreed']);
    const sm = await call(s.router, 'GET', '/summary/today', o); expect(sm.body.data.actions.length > 0).toBe(true); expect(sm.body.data.actions.every((a) => a.suggestOnly === true)).toBe(true);
    const pr = await call(s.router, 'GET', '/predictions', o); expect(pr.body.data.nextMonthSales.estimate).toBe(true); expect(pr.body.data.nextMonthSales.enough).toBe(false); expect(pr.body.data.busyTimes.enough).toBe(false);
    expect((await call(s.router, 'GET', '/summary/today', staffOf(s.A.id, s.A.staffId))).code).toBe(403); // revenue and lists are for the owner only
  });
});
describe('Salon routes: static guards', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'routes.js'), 'utf8');
  const callsOf = () => { const out = []; const re = /M\.(\w+)\.(find|findOne|findOneAndUpdate|updateOne|updateMany|countDocuments|create|insertMany|findById)\(/g; let m;
    while ((m = re.exec(src))) { let d = 1, i = re.lastIndex; while (d && i < src.length) { if (src[i] === '(') d++; else if (src[i] === ')') d--; i++; } out.push([m[1], m[2], src.slice(m.index, i)]); } return out; };
  test('every query or write on a tenant model names tenantId (except the business record itself)', () => {
    const calls = callsOf(); expect(calls.length).toBeGreaterThan(80);
    const bad = calls.filter(([model, , text]) => { if (model === 'Tenant' || /tenantId/.test(text)) return false; const at = src.indexOf(text); return !/const q = \{[^}]*tenantId: tid/.test(src.slice(Math.max(0, at - 500), at)); });
    expect(bad.map((b) => b[2].slice(0, 80))).toEqual([]);
  });
  test('the business record is only read or changed by its own id (the logged-in business)', () => {
    for (const [model, , text] of callsOf()) if (model === 'Tenant') expect(/findById\(tid\)|_id: tid|bookingToken: token/.test(text)).toBe(true);
  });
  test('money, settings and reports routes are owner only; staff routes are the few that staff need', () => {
    const { mongoose } = fakeMongoose(); const r = createSalonRouter({ express: { Router: () => fakeRouter() }, mongoose, protect: () => {}, authorize: () => () => {}, tenantOf: () => '' });
    const ownerOnly = ['/bills', '/commission', '/summary/today', '/lists/winback', '/settings', '/expenses', '/dues', '/day-close', '/accounts/pnl', '/accounts/gst', '/accounts/export.csv', '/reports/sales', '/predictions', '/alerts', '/marketing/ideas', '/services', '/staff'];
    for (const route of r.routes) if (ownerOnly.includes(route.path) && !(route.method === 'GET' && ['/services', '/staff'].includes(route.path)) && !(route.method === 'POST' && route.path === '/bills')) expect(route.h.length).toBe(2);
    expect(r.routes.length).toBeGreaterThan(40);
  });
});
