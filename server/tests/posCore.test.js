// Database test for the shared shop module (packages/core-pos). Auth is faked with a header; nothing else is mocked.
const express = require('express');
const mongoose = require('mongoose');
const request = require('supertest');
const db = require('./helpers/db');
const { createPosRouter } = require('../../packages/core-pos');

const A = new mongoose.Types.ObjectId().toString();
const B = new mongoose.Types.ObjectId().toString();
const protect = (req, res, next) => { const t = req.headers['x-tenant']; if (!t) return res.status(401).json({ success: false }); req.user = { id: new mongoose.Types.ObjectId().toString(), subscriberId: t, role: 'admin' }; next(); };
const authorize = () => (req, res, next) => next();

describe('core-pos routes', () => {
  let app;
  beforeAll(async () => {
    await db.connect();
    app = express(); app.use(express.json());
    app.use('/pos', createPosRouter({ express, mongoose, protect, authorize, tenantOf: (req) => new mongoose.Types.ObjectId(req.user.subscriberId) }));
  });
  afterAll(async () => { await db.clearDatabase(); await db.closeDatabase(); });
  const as = (t) => ({ 'x-tenant': t });

  test('needs sign-in', async () => { expect((await request(app).get('/pos/items')).status).toBe(401); });

  test('items, customers and a paid bill with GST, stock and points', async () => {
    const item = (await request(app).post('/pos/items').set(as(A)).send({ name: 'Shampoo', price: 118, gstRate: 18, trackStock: true, qty: 10, reorderLevel: 3 })).body.data;
    const cust = (await request(app).post('/pos/customers').set(as(A)).send({ name: 'Asha', phone: '9876500001' })).body.data;
    const r = await request(app).post('/pos/bills').set(as(A)).send({ customerId: cust._id, lines: [{ itemId: item._id, qty: 2 }], taxMode: 'gst_inclusive', payments: [{ method: 'cash', amount: 300 }] });
    expect(r.status).toBe(201);
    expect(r.body.data.total).toBe(236);
    expect(r.body.data.gst).toBe(36);
    expect(r.body.data.change).toBe(64);
    expect(r.body.data.status).toBe('paid');
    expect(r.body.data.number).toMatch(/^BILL\/\d{4}-\d{2}\/0001$/);
    const items = (await request(app).get('/pos/items').set(as(A))).body.data;
    expect(items[0].qty).toBe(8);
    const c = (await request(app).get(`/pos/customers/${cust._id}`).set(as(A))).body.data;
    expect(c.points).toBe(Math.floor((236 * 5) / 100));
  });

  test('selling more than the stock is refused and nothing changes', async () => {
    const item = (await request(app).post('/pos/items').set(as(A)).send({ name: 'Gel', price: 100, trackStock: true, qty: 1 })).body.data;
    const r = await request(app).post('/pos/bills').set(as(A)).send({ lines: [{ itemId: item._id, qty: 5 }], payments: [{ method: 'cash', amount: 500 }] });
    expect(r.status).toBe(409);
    const now = (await request(app).get(`/pos/items?barcode=none`).set(as(A))).status;
    expect(now).toBe(200);
  });

  test('a retry with the same clientId returns the first bill, not a second one', async () => {
    const body = { clientId: 'dev1-0001', lines: [{ name: 'Trim', unitPrice: 150, qty: 1 }], payments: [{ method: 'upi', amount: 150 }] };
    const a = await request(app).post('/pos/bills').set(as(A)).send(body);
    const b = await request(app).post('/pos/bills').set(as(A)).send(body);
    expect(a.status).toBe(201); expect(b.status).toBe(200);
    expect(b.body.data._id).toBe(a.body.data._id);
  });

  test('pay-later needs a customer and adds to what they owe', async () => {
    const noCust = await request(app).post('/pos/bills').set(as(A)).send({ lines: [{ name: 'x', unitPrice: 100, qty: 1 }], payments: [{ method: 'credit', amount: 100 }] });
    expect(noCust.status).toBe(400);
    const cust = (await request(app).post('/pos/customers').set(as(A)).send({ name: 'Ravi', phone: '9876500002' })).body.data;
    const r = await request(app).post('/pos/bills').set(as(A)).send({ customerId: cust._id, lines: [{ name: 'x', unitPrice: 100, qty: 1 }], payments: [{ method: 'credit', amount: 100 }] });
    expect(r.body.data.status).toBe('credit');
    expect((await request(app).get(`/pos/customers/${cust._id}`).set(as(A))).body.data.customer.creditDue).toBe(100);
  });

  test('return puts the stock back, once only', async () => {
    const item = (await request(app).post('/pos/items').set(as(A)).send({ name: 'Wax', price: 200, trackStock: true, qty: 5 })).body.data;
    const bill = (await request(app).post('/pos/bills').set(as(A)).send({ lines: [{ itemId: item._id, qty: 2 }], payments: [{ method: 'cash', amount: 400 }] })).body.data;
    expect((await request(app).post(`/pos/bills/${bill._id}/return`).set(as(A))).status).toBe(200);
    expect((await request(app).post(`/pos/bills/${bill._id}/return`).set(as(A))).status).toBe(409);
    const wax = (await request(app).get('/pos/items').set(as(A))).body.data.find((i) => i.name === 'Wax');
    expect(wax.qty).toBe(5);
  });

  test('another business cannot see or use this business data', async () => {
    const item = (await request(app).post('/pos/items').set(as(A)).send({ name: 'Secret', price: 50, trackStock: true, qty: 3 })).body.data;
    const cust = (await request(app).post('/pos/customers').set(as(A)).send({ name: 'Private', phone: '9876500009' })).body.data;
    expect((await request(app).get('/pos/items').set(as(B))).body.data).toHaveLength(0);
    expect((await request(app).get(`/pos/customers/${cust._id}`).set(as(B))).status).toBe(404);
    expect((await request(app).post('/pos/bills').set(as(B)).send({ lines: [{ itemId: item._id, qty: 1 }], payments: [{ method: 'cash', amount: 50 }] })).status).toBe(404);
    expect((await request(app).post(`/pos/items/${item._id}/stock`).set(as(B)).send({ type: 'purchase', qty: 5 })).status).toBe(404);
    const bills = (await request(app).get('/pos/bills').set(as(A))).body.data;
    expect((await request(app).get(`/pos/bills/${bills[0]._id}`).set(as(B))).status).toBe(404);
    expect((await request(app).post(`/pos/bills/${bills[0]._id}/return`).set(as(B))).status).toBe(409);
  });

  test('same phone twice in one business is refused, but allowed in another business', async () => {
    await request(app).post('/pos/customers').set(as(A)).send({ name: 'One', phone: '9000000111' });
    expect((await request(app).post('/pos/customers').set(as(A)).send({ name: 'Two', phone: '9000000111' })).status).toBe(409);
    expect((await request(app).post('/pos/customers').set(as(B)).send({ name: 'Three', phone: '9000000111' })).status).toBe(201);
  });

  test('stock movement, low-stock and expiry reports', async () => {
    const item = (await request(app).post('/pos/items').set(as(B)).send({ name: 'Cream', price: 80, trackStock: true, qty: 2, reorderLevel: 5, expiresAt: new Date(Date.now() + 10 * 86400000) })).body.data;
    expect((await request(app).post(`/pos/items/${item._id}/stock`).set(as(B)).send({ type: 'sale', qty: 5 })).status).toBe(400);
    expect((await request(app).post(`/pos/items/${item._id}/stock`).set(as(B)).send({ type: 'purchase', qty: 1 })).status).toBe(200);
    expect((await request(app).get('/pos/reports/low-stock').set(as(B))).body.data.map((i) => i.name)).toContain('Cream');
    expect((await request(app).get('/pos/reports/expiring?days=30').set(as(B))).body.data.map((i) => i.name)).toContain('Cream');
  });
});
