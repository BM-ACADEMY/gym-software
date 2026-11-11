// Route tests for Mart. NEED A DATABASE: written, not yet run by a person (Dev A).
// Run: MONGODB_TEST_URI=mongodb://localhost:27017/mart_test MART_SESSION_SECRET=<32+ random chars> npx jest tests/routes.db.test.js
// The database name must end in "test"; it is emptied before the run. Skipped (with a note) when MONGODB_TEST_URI is not set.
const URI = process.env.MONGODB_TEST_URI;
const run = URI && /test$/.test(URI) ? describe : describe.skip;
run('Mart routes (needs a test database)', () => {
  const express = require('express'); const mongoose = require('mongoose'); const request = require('supertest');
  const { createApp } = require('../src/app');
  let app; const cookies = {};
  const H = { 'x-requested-with': 'afra-mart' };
  const signUp = async (key, email) => {
    const r = await request(app).post('/api/mart/auth/signup').set(H).send({ shopName: 'Shop ' + key, ownerName: 'Owner ' + key, email, state: 'Tamil Nadu', password: 'a-long-password-1', acceptTerms: true });
    expect(r.status).toBe(201); cookies[key] = r.headers['set-cookie'][0].split(';')[0];
  };
  const as = (key, method, url) => request(app)[method](url).set('Cookie', cookies[key]).set(H);
  beforeAll(async () => {
    await mongoose.connect(URI); await mongoose.connection.dropDatabase();
    app = createApp({ express, mongoose, env: { MONGODB_URI: URI, MART_SESSION_SECRET: process.env.MART_SESSION_SECRET || 'k'.repeat(40) } });
    await signUp('A', 'a@example.com'); await signUp('B', 'b@example.com');
  });
  afterAll(async () => { await mongoose.connection.dropDatabase(); await mongoose.disconnect(); });

  const GETS = ['/settings', '/udhaar', '/reports/reorder', '/reports/expiry', '/reports/dead-stock', '/reports/leaks', '/summary', '/expenses', '/reports/expenses', '/suppliers', '/day-close', '/reports/profit-loss', '/reports/ca-export', '/reports/sales', '/reports/forecast', '/marketing'];
  const WRITES = [['put', '/settings'], ['post', '/udhaar/payments'], ['post', '/reports/stock-check'], ['post', '/expenses'], ['post', '/suppliers'], ['post', '/suppliers/aaaaaaaaaaaaaaaaaaaaaaaa/purchases'], ['post', '/suppliers/aaaaaaaaaaaaaaaaaaaaaaaa/pay'], ['post', '/day-close']];
  test('every route refuses a signed-out visitor', async () => {
    for (const u of GETS) expect((await request(app).get('/api/mart' + u)).status).toBe(401);
    for (const [m, u] of WRITES) expect((await request(app)[m]('/api/mart' + u).set(H).send({})).status).toBe(401);
  });
  test('every read route answers a signed-in shop with success', async () => {
    for (const u of GETS) { const r = await as('A', 'get', '/api/mart' + u); expect([u, r.status]).toEqual([u, 200]); }
  });
  test('settings: bad values refused, good values saved and read back', async () => {
    expect((await as('A', 'put', '/api/mart/settings').send({ overdueGraceDays: 0 })).status).toBe(400);
    expect((await as('A', 'put', '/api/mart/settings').send({})).status).toBe(400);
    const ok = await as('A', 'put', '/api/mart/settings').send({ overdueGraceDays: 10, defaultCreditLimit: 1000, festivals: [{ name: 'Pongal', date: '2027-01-14' }] });
    expect(ok.status).toBe(200); expect(ok.body.data.overdueGraceDays).toBe(10);
    expect((await as('B', 'get', '/api/mart/settings')).body.data.overdueGraceDays).toBe(15); // shop B is not changed
  });
  test('udhaar: pay-later bill, credit limit refuses the next one, payment lowers the balance, cannot over-pay, other shop cannot touch it', async () => {
    const c = await as('A', 'post', '/api/mart/pos/customers').send({ name: 'Ravi', phone: '9876543210' }); expect(c.status).toBe(201);
    const cid = c.body.data._id;
    const item = await as('A', 'post', '/api/mart/pos/items').send({ name: 'Rice', price: 600, cost: 500, gstRate: 0, trackStock: true, qty: 50, reorderLevel: 5 }); expect(item.status).toBe(201);
    const bill = await as('A', 'post', '/api/mart/pos/bills').send({ customerId: cid, lines: [{ itemId: item.body.data._id, qty: 1 }], payments: [{ method: 'credit', amount: 600 }] });
    expect(bill.status).toBe(201);
    const over = await as('A', 'post', '/api/mart/pos/bills').send({ customerId: cid, lines: [{ itemId: item.body.data._id, qty: 1 }], payments: [{ method: 'credit', amount: 600 }] });
    expect(over.status).toBe(409); expect(over.body.code).toBe('credit_limit');
    const u = await as('A', 'get', '/api/mart/udhaar'); expect(u.body.data.totalDue).toBe(600);
    expect((await as('A', 'post', '/api/mart/udhaar/payments').send({ customerId: cid, amount: 700 })).status).toBe(400);
    expect((await as('A', 'post', '/api/mart/udhaar/payments').send({ customerId: cid, amount: 10.5 })).status).toBe(400);
    expect((await as('B', 'post', '/api/mart/udhaar/payments').send({ customerId: cid, amount: 100 })).status).toBe(404);
    const pay = await as('A', 'post', '/api/mart/udhaar/payments').send({ customerId: cid, amount: 250 }); expect(pay.status).toBe(201); expect(pay.body.data.balance).toBe(350);
    expect((await as('A', 'get', '/api/mart/udhaar')).body.data.totalDue).toBe(350);
    expect((await as('B', 'get', '/api/mart/udhaar')).body.data.totalDue).toBe(0);
  });
  test('stock check compares typed counts with the system and ignores other shops items', async () => {
    const items = (await as('A', 'get', '/api/mart/pos/items')).body.data; const id = items[0]._id;
    const r = await as('A', 'post', '/api/mart/reports/stock-check').send({ counts: [{ itemId: id, counted: 40 }] });
    expect(r.status).toBe(200); expect(r.body.data[0].kind).toBe('short');
    expect((await as('B', 'post', '/api/mart/reports/stock-check').send({ counts: [{ itemId: id, counted: 1 }] })).body.data).toEqual([]);
  });
  test('expenses, suppliers, purchases and payments; money stays whole rupees; other shop gets 404', async () => {
    expect((await as('A', 'post', '/api/mart/expenses').send({ category: 'rent', amount: 8000.5 })).status).toBe(400);
    expect((await as('A', 'post', '/api/mart/expenses').send({ category: 'nope', amount: 10 })).status).toBe(400);
    expect((await as('A', 'post', '/api/mart/expenses').send({ category: 'rent', amount: 8000 })).status).toBe(201);
    expect((await as('B', 'get', '/api/mart/expenses')).body.data.length).toBe(0);
    const s = await as('A', 'post', '/api/mart/suppliers').send({ name: 'Sri Traders' }); expect(s.status).toBe(201); const sid = s.body.data._id;
    expect((await as('B', 'post', `/api/mart/suppliers/${sid}/purchases`).send({ amount: 100 })).status).toBe(404);
    expect((await as('A', 'post', `/api/mart/suppliers/${sid}/purchases`).send({ amount: 1000, paid: 300 })).status).toBe(201);
    expect((await as('A', 'get', '/api/mart/suppliers')).body.data[0].due).toBe(700);
    expect((await as('A', 'post', `/api/mart/suppliers/${sid}/pay`).send({ amount: 5000 })).status).toBe(400);
    expect((await as('B', 'post', `/api/mart/suppliers/${sid}/pay`).send({ amount: 100 })).status).toBe(404);
    expect((await as('A', 'post', `/api/mart/suppliers/${sid}/pay`).send({ amount: 700 })).status).toBe(200);
    expect((await as('A', 'get', '/api/mart/suppliers')).body.data[0].due).toBe(0);
  });
  test('day close saves one row per day; profit and loss and the CA file read the same data', async () => {
    expect((await as('A', 'post', '/api/mart/day-close').send({ counted: -5 })).status).toBe(400);
    const d1 = await as('A', 'post', '/api/mart/day-close').send({ counted: 0, openingCash: 0 }); expect(d1.status).toBe(200);
    expect((await as('A', 'post', '/api/mart/day-close').send({ counted: 0, openingCash: 0 })).status).toBe(200);
    const pl = await as('A', 'get', '/api/mart/reports/profit-loss'); expect(pl.body.data.expenses).toBe(8000);
    const csv = await as('A', 'get', '/api/mart/reports/ca-export'); expect(csv.headers['content-type']).toMatch(/text\/csv/); expect(csv.text.split('\n')[0]).toMatch(/^Type,Date/);
    expect((await as('B', 'get', '/api/mart/reports/profit-loss')).body.data.expenses).toBe(0);
  });
  test('D-30 discount rule: owner sets it, staff limited, bill records who and percent, owner sees it', async () => {
    // sign-up makes an owner (admin). A staff user (role subadmin) must be created directly for this test.
    const U = mongoose.model('MartUser'); const A = await U.findOne({ email: 'a@example.com' }); const hash = (await U.findOne({ email: 'a@example.com' }).select('+passwordHash')).passwordHash;
    await U.create({ tenantId: A.tenantId, name: 'Staff', email: 'staff@example.com', role: 'subadmin', passwordHash: hash });
    const lg = await request(app).post('/api/mart/auth/login').set(H).send({ email: 'staff@example.com', password: 'a-long-password-1' }); expect(lg.status).toBe(200); cookies.S = lg.headers['set-cookie'][0].split(';')[0];
    expect((await as('S', 'put', '/api/mart/settings').send({ discountRule: { staff: 'any' } })).status).toBe(403); // staff cannot change the rule
    expect((await as('A', 'put', '/api/mart/settings').send({ discountRule: { staff: 'limit', maxPercent: 101 } })).status).toBe(400);
    expect((await as('A', 'put', '/api/mart/settings').send({ discountRule: { staff: 'limit', maxPercent: 10 } })).status).toBe(200);
    const item = (await as('A', 'get', '/api/mart/pos/items')).body.data[0];
    const mk = (value, reason) => ({ lines: [{ itemId: item._id, qty: 1 }], billDiscount: { type: 'amount', value }, discountReason: reason, payments: [{ method: 'cash', amount: 1000 }] });
    expect((await as('S', 'post', '/api/mart/pos/bills').send(mk(200, 'regular'))).status).toBe(403); // 33 percent
    expect((await as('S', 'post', '/api/mart/pos/bills').send(mk(20, ''))).status).toBe(400); // no reason
    expect((await as('S', 'post', '/api/mart/pos/bills').send(mk(20, 'regular customer'))).status).toBe(201);
    expect((await as('A', 'post', '/api/mart/pos/bills').send(mk(300, 'owner choice'))).status).toBe(201); // owner not limited
    const lk = await as('A', 'get', '/api/mart/reports/leaks'); expect(lk.body.data.staffDiscounts[0].count).toBe(1); expect(lk.body.data.staffDiscounts[0].total).toBe(20);
    expect((await as('B', 'get', '/api/mart/reports/leaks')).body.data.staffDiscounts).toEqual([]);
    expect((await as('A', 'get', '/api/mart/summary')).body.data.staffDiscounts.length).toBe(1);
  });
  test('summary has at most three actions, each with a reason', async () => {
    const r = await as('A', 'get', '/api/mart/summary'); expect(r.status).toBe(200);
    expect(r.body.data.actions.length <= 3).toBe(true); for (const a of r.body.data.actions) expect(!!a.reason).toBe(true);
  });
  test('phase 2: roles. Owner adds a cashier; the cashier can bill and close the day but not see accounts, staff, audit or privacy; another shop cannot see the team', async () => {
    const mkU = await as('A', 'post', '/api/mart/team').send({ name: 'Cash Ier', email: 'cashier@example.com', role: 'cashier', password: 'a-long-password-2' }); expect(mkU.status).toBe(201);
    const lg = await request(app).post('/api/mart/auth/login').set(H).send({ email: 'cashier@example.com', password: 'a-long-password-2' }); expect(lg.status).toBe(200); cookies.C = lg.headers['set-cookie'][0].split(';')[0];
    for (const u of ['/expenses', '/audit', '/payroll', '/team', '/privacy/export', '/settings', '/summary']) expect([u, (await as('C', 'get', '/api/mart' + u)).status]).toEqual([u, 403]);
    expect((await as('C', 'get', '/api/mart/day-closes')).status).toBe(200); expect((await as('C', 'get', '/api/mart/pos/items')).status).toBe(200); expect((await as('C', 'post', '/api/mart/pos/items').send({ name: 'x', price: 1 })).status).toBe(403);
    expect((await as('B', 'get', '/api/mart/team')).body.data.length).toBe(1);
    expect((await as('A', 'post', '/api/mart/team/' + mkU.body.data.id + '/deactivate')).status).toBe(200); expect((await as('C', 'get', '/api/mart/day-closes')).status).toBe(401);
  });
  test('phase 2: payroll, audit and privacy for the owner', async () => {
    expect((await as('A', 'post', '/api/mart/staff').send({ name: 'Meena', monthlySalary: 9000 })).status).toBe(201);
    expect((await as('A', 'post', '/api/mart/attendance').send({ staff: 'Meena', status: 'present' })).status).toBe(201);
    const pay = await as('A', 'get', '/api/mart/payroll'); expect(pay.status).toBe(200); expect(pay.body.data[0].draft).toBe(true); expect((await as('B', 'get', '/api/mart/payroll')).body.data.length).toBe(0);
    expect((await as('A', 'get', '/api/mart/audit')).body.data.some((a) => a.action === 'staff_add')).toBe(true);
    const ex = await as('A', 'get', '/api/mart/privacy/export'); expect(ex.status).toBe(200); expect(ex.headers['cache-control']).toMatch(/no-store/);
    expect((await as('A', 'post', '/api/mart/privacy/delete-shop-request').send({ confirm: 'no' })).status).toBe(400);
  });
  test('expired account is read-only for writes but can still read', async () => {
    await mongoose.model('MartTenant').updateMany({}, { $set: { trialEndsAt: new Date(Date.now() - 20 * 86400000) } });
    expect((await as('A', 'post', '/api/mart/expenses').send({ category: 'rent', amount: 10 })).status).toBe(402);
    expect((await as('A', 'get', '/api/mart/expenses')).status).toBe(200);
  });
});
