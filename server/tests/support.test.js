const request = require('supertest');
const app = require('../app');
const db = require('./helpers/db');
const { createTenant } = require('./helpers/factories');

describe('Owner support tickets', () => {
  let a, b;
  beforeAll(async () => {
    await db.connect();
    a = await createTenant({ gymName: 'Gym A' });
    b = await createTenant({ gymName: 'Gym B' });
  });
  afterAll(async () => { await db.clearDatabase(); await db.closeDatabase(); });

  const post = (tok, body) => request(app).post('/api/admin/support').set('Authorization', `Bearer ${tok}`).send(body);

  test('creates a ticket and lists only own gym tickets', async () => {
    expect((await post(a.adminToken, { subject: 'Import failing', description: 'Row 3' })).status).toBe(201);
    expect((await post(b.adminToken, { subject: 'Other gym ticket' })).status).toBe(201);
    const res = await request(app).get('/api/admin/support').set('Authorization', `Bearer ${a.adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].subject).toBe('Import failing');
  });

  test('rejects empty, non-string and oversized input', async () => {
    expect((await post(a.adminToken, { subject: '   ' })).status).toBe(400);
    expect((await post(a.adminToken, { subject: { $gt: '' } })).status).toBe(400);
    expect((await post(a.adminToken, { subject: 'x'.repeat(201) })).status).toBe(400);
    expect((await post(a.adminToken, { subject: 'ok', description: 'y'.repeat(4001) })).status).toBe(400);
  });

  test('needs a login', async () => {
    expect((await request(app).get('/api/admin/support')).status).toBe(401);
  });
});
