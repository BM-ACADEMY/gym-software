const request = require('supertest');
const app = require('../app');
const db = require('./helpers/db');

describe('health check', () => {
  beforeAll(async () => { await db.connect(); });
  afterAll(async () => { await db.closeDatabase(); });
  test('returns 200 while the database is connected', async () => {
    const r = await request(app).get('/api/health');
    expect(r.status).toBe(200);
    expect(r.body.success).toBe(true);
  });
});
