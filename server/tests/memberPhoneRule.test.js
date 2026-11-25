// RM-10 business rule (Kamarudeen, 25 Nov): one phone number belongs to one member per gym; another gym may have it too.
const request = require('supertest');
const app = require('../app');
const db = require('./helpers/db');
const { createTenant } = require('./helpers/factories');
const Member = require('../models/Member');

const auth = (t) => ({ Authorization: `Bearer ${t.adminToken}` });
const add = (t, body) => request(app).post('/api/admin/members').set(auth(t)).send(body);

describe('one phone number per member in a gym (RM-10, MEM-03)', () => {
  beforeAll(async () => { await db.connect(); });
  afterAll(async () => { await db.clearDatabase(); await db.closeDatabase(); });

  test('the same number twice in one gym is refused; another gym may use it', async () => {
    const a = await createTenant(); const b = await createTenant();
    expect((await add(a, { name: 'Ravi', phone: '9876543210' })).status).toBe(201);
    const dup = await add(a, { name: 'Ravi Brother', phone: ' 9876543210 ' });
    expect(dup.status).toBe(409); expect(dup.body.message).toMatch(/already exists/);
    expect(await Member.countDocuments({ subscriberId: a.subscriber._id })).toBe(1);
    expect((await add(b, { name: 'Ravi', phone: '9876543210' })).status).toBe(201);
  });

  test('changing a member to a number another member has is refused; keeping their own is fine', async () => {
    const a = await createTenant();
    await add(a, { name: 'Ravi', phone: '9876543210' });
    const kumar = (await add(a, { name: 'Kumar', phone: '9123456780' })).body.data;
    expect((await request(app).put(`/api/admin/members/${kumar._id}`).set(auth(a)).send({ phone: '9876543210' })).status).toBe(409);
    expect((await Member.findById(kumar._id)).phone).toBe('9123456780');
    expect((await request(app).put(`/api/admin/members/${kumar._id}`).set(auth(a)).send({ phone: '9123456780', name: 'Kumar S' })).status).toBe(200);
  });

  test('members without a phone are not blocked by each other', async () => {
    const a = await createTenant();
    expect((await add(a, { name: 'No Phone 1' })).status).toBe(201);
    expect((await add(a, { name: 'No Phone 2' })).status).toBe(201);
  });
});
