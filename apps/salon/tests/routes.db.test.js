// Route tests for Salon (Groom). NEED A DATABASE: written, not yet run by a person (Dev A).
// Run: MONGODB_TEST_URI=mongodb://localhost:27017/salon_test SALON_SESSION_SECRET=<32+ random chars> npx jest tests/routes.db.test.js
// The database name must end in "test"; it is emptied before the run. Skipped (with a note) when MONGODB_TEST_URI is not set.
const URI = process.env.MONGODB_TEST_URI;
const run = URI && /test$/.test(URI) ? describe : describe.skip;
jest.setTimeout(60000); // first connect and password hashing can take longer than the 5-second default on a CI runner
run('Salon routes (needs a test database)', () => {
  const express = require('express'); const mongoose = require('mongoose'); const request = require('supertest');
  const { createApp } = require('../src/app'); const B = require('../src/booking');
  let app; const cookies = {}; const ids = {};
  const H = { 'x-requested-with': 'afra-groom' };
  const signUp = async (key, email) => {
    const r = await request(app).post('/api/salon/auth/signup').set(H).send({ businessName: 'Salon ' + key, ownerName: 'Owner ' + key, email, state: 'Tamil Nadu', password: 'a-long-password-1', acceptTerms: true, preset: 'salon' });
    expect(r.status).toBe(201); cookies[key] = r.headers['set-cookie'][0].split(';')[0];
  };
  const as = (key, method, url) => request(app)[method]('/api/salon' + url).set('Cookie', cookies[key]).set(H);
  beforeAll(async () => {
    await mongoose.connect(URI); await mongoose.connection.dropDatabase();
    app = createApp({ express, mongoose, env: { MONGODB_URI: URI, SALON_SESSION_SECRET: process.env.SALON_SESSION_SECRET || 'k'.repeat(40) } });
    await signUp('A', 'a@example.com'); await signUp('B', 'b@example.com');
    for (const k of ['A', 'B']) { ids[k] = { staff: (await as(k, 'get', '/staff')).body.data[0].id, services: (await as(k, 'get', '/services')).body.data }; }
  });
  afterAll(async () => { await mongoose.connection.dropDatabase(); await mongoose.disconnect(); });

  const GETS = ['/services', '/staff', '/customers', '/appointments', '/queue', '/bills', '/summary/today', '/lists/winback', '/settings', '/dues', '/day-close', '/predictions', '/alerts', '/marketing/ideas'];
  test('every route refuses a signed-out visitor', async () => {
    for (const u of GETS) expect((await request(app).get('/api/salon' + u)).status).toBe(401);
    expect((await request(app).post('/api/salon/bills').set(H).send({})).status).toBe(401);
  });
  test('sign-up gives the preset services and the owner as first staff member (first win)', () => {
    expect(ids.A.services.length).toBe(4); expect(ids.A.services.every((s) => s.price === 0)).toBe(true);
  });
  test('every read route answers a signed-in business with success', async () => {
    const t = B.istParts().date;
    for (const u of GETS) { const r = await as('A', 'get', u); expect([u, r.status]).toEqual([u, 200]); }
    for (const u of ['/accounts/pnl', '/accounts/gst', '/reports/sales', '/expenses', '/commission']) { const r = await as('A', 'get', `${u}?from=${t}&to=${t}`); expect([u, r.status]).toEqual([u, 200]); }
  });
  test('two businesses never see each other: appointments, customers, bills, cancel by id', async () => {
    let day = B.addDays(B.istParts().date, 2); while (B.weekday(day) === 0) day = B.addDays(day, 1);
    const svc = ids.A.services[0].key;
    const a = await as('A', 'post', '/appointments').send({ date: day, start: 600, staffId: ids.A.staff, serviceKey: svc, name: 'Ravi Kumar', phone: '9840012210' }); expect(a.status).toBe(201);
    expect((await as('A', 'post', '/appointments').send({ date: day, start: 600, staffId: ids.A.staff, serviceKey: svc, name: 'Other Person', phone: '9944551872' })).status).toBe(409);
    expect((await as('B', 'get', `/appointments?date=${day}`)).body.data.length).toBe(0);
    expect((await as('B', 'post', `/appointments/${a.body.data.id}/cancel`)).status).toBe(404);
    expect((await as('B', 'get', '/customers')).body.data.length).toBe(0);
    expect((await as('B', 'post', '/appointments').send({ date: day, start: 660, staffId: ids.A.staff, serviceKey: svc, name: 'X Y', phone: '9840012211' })).status).toBe(400);
  });
  test('two requests for the same slot at once: exactly one wins (unique index on active visits)', async () => {
    let day = B.addDays(B.istParts().date, 3); while (B.weekday(day) === 0) day = B.addDays(day, 1);
    const svc = ids.A.services[0].key;
    const go = (n, p) => as('A', 'post', '/appointments').send({ date: day, start: 1080, staffId: ids.A.staff, serviceKey: svc, name: 'Racer ' + n, phone: p });
    const r = await Promise.all([go(1, '9840000001'), go(2, '9840000002'), go(3, '9840000003')]);
    expect(r.filter((x) => x.status === 201).length).toBe(1); expect(r.filter((x) => x.status === 409).length).toBe(2);
  });
  test('public booking link: consent needed, secret token, other business untouched', async () => {
    const token = (await as('A', 'get', '/settings')).body.data.bookingToken; let day = B.addDays(B.istParts().date, 4); while (B.weekday(day) === 0) day = B.addDays(day, 1);
    const book = (patch, tk = token) => request(app).post(`/api/salon-book/${tk}/book`).send({ date: day, start: 600, staffId: ids.A.staff, serviceKey: ids.A.services[0].key, name: 'Visitor', phone: '9840077777', consent: true, ...patch });
    expect((await book({ consent: false })).status).toBe(400); expect((await book({}, 'f'.repeat(48))).status).toBe(404); expect((await book({})).status).toBe(201);
    expect((await as('B', 'get', '/customers')).body.data.length).toBe(0);
  });
  test('a staff login sees masked phones and cannot open money screens', async () => {
    const mk = await as('A', 'post', '/staff').send({ name: 'Front Desk', email: 'desk@example.com', password: 'a-long-password-2' }); expect(mk.status).toBe(201);
    const login = await request(app).post('/api/salon/auth/login').set(H).send({ email: 'desk@example.com', password: 'a-long-password-2' }); expect(login.status).toBe(200);
    const c = login.headers['set-cookie'][0].split(';')[0];
    const cust = await request(app).get('/api/salon/customers').set('Cookie', c); expect(cust.body.data.every((x) => /\*/.test(x.phone))).toBe(true);
    for (const u of ['/summary/today', '/dues', '/bills', '/settings']) expect((await request(app).get('/api/salon' + u).set('Cookie', c)).status).toBe(403);
  });
});
