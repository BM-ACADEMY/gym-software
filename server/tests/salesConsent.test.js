const request = require('supertest');
const app = require('../app');
const db = require('./helpers/db');
const { createTenant } = require('./helpers/factories');
const Admin = require('../models/Admin');

const body = (o = {}) => ({ gymName: 'Iron House', ownerName: 'Ravi', email: 'ravi@example.com', phone: '9876543210', password: 'strongpass1', ...o });

describe('"OK to call me" permission (gym owner)', () => {
  beforeAll(async () => { await db.connect(); });
  afterAll(async () => { await db.clearDatabase(); await db.closeDatabase(); });

  test('sign-up without the tick leaves it off', async () => {
    const res = await request(app).post('/api/auth/signup').send(body());
    expect(res.status).toBe(201);
    const a = await Admin.findById(res.body.data.id);
    expect(a.salesContactOk).toBe(false);
  });

  test('sign-up with a real true turns it on and records the time; "yes" or 1 do not', async () => {
    const on = await request(app).post('/api/auth/signup').send(body({ email: 'a@example.com', phone: '9000000002', salesContactOk: true }));
    const a = await Admin.findById(on.body.data.id);
    expect(a.salesContactOk).toBe(true);
    expect(a.salesContactAt).toBeTruthy();
    const odd = await request(app).post('/api/auth/signup').send(body({ email: 'b@example.com', phone: '9000000003', salesContactOk: 'yes' }));
    expect((await Admin.findById(odd.body.data.id)).salesContactOk).toBe(false);
  });

  test('owner can switch it on and off in Settings; other values are ignored', async () => {
    const t = await createTenant();
    const put = (b) => request(app).put('/api/admin/settings/profile').set('Authorization', `Bearer ${t.adminToken}`).send(b);
    expect((await put({ salesContactOk: true })).body.data.salesContactOk).toBe(true);
    expect((await put({ salesContactOk: 'no' })).body.data.salesContactOk).toBe(true);
    expect((await put({ salesContactOk: false })).body.data.salesContactOk).toBe(false);
    const get = await request(app).get('/api/admin/settings').set('Authorization', `Bearer ${t.adminToken}`);
    expect(get.body.data.profile.salesContactOk).toBe(false);
  });

  test('it only changes the signed-in owner, not another gym', async () => {
    const a = await createTenant();
    const b = await createTenant();
    await request(app).put('/api/admin/settings/profile').set('Authorization', `Bearer ${a.adminToken}`).send({ salesContactOk: true });
    expect((await Admin.findById(b.admin._id)).salesContactOk).toBe(false);
  });

  test('needs a login', async () => {
    expect((await request(app).put('/api/admin/settings/profile').send({ salesContactOk: true })).status).toBe(401);
  });
});
