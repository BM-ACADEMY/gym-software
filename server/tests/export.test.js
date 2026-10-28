const request = require('supertest');
const app = require('../app');
const db = require('./helpers/db');
const { createTenant, createMember } = require('./helpers/factories');
const { cell, toCsv } = require('../routes/admin/export');

describe('csv helpers (pure)', () => {
  test('neutralises spreadsheet formulas and quotes commas/quotes/newlines', () => {
    expect(cell('=1+1')).toBe("'=1+1");
    expect(cell('+91 98765')).toBe("'+91 98765");
    expect(cell('a,b')).toBe('"a,b"');
    expect(cell('say "hi"')).toBe('"say ""hi"""');
    expect(cell(null)).toBe('');
    expect(toCsv(['A', 'B'], [['x', 'y']])).toBe('A,B\r\nx,y\r\n');
  });
});

describe('data export', () => {
  let a, b;
  beforeAll(async () => {
    await db.connect();
    a = await createTenant({ gymName: 'Export A' });
    b = await createTenant({ gymName: 'Export B' });
    await createMember(a.subscriber, { name: 'Alice Member', phone: '9000000021' });
    await createMember(b.subscriber, { name: 'Bob Other Gym', phone: '9000000022' });
  });
  afterAll(async () => { await db.clearDatabase(); await db.closeDatabase(); });

  test('members.csv has only this gym\'s members', async () => {
    const r = await request(app).get('/api/admin/export/members.csv').set('Authorization', `Bearer ${a.adminToken}`);
    expect(r.status).toBe(200);
    expect(r.headers['content-type']).toMatch(/text\/csv/);
    expect(r.text).toMatch(/Alice Member/);
    expect(r.text).not.toMatch(/Bob Other Gym/);
  });

  test('payments and attendance exports respond, and need a login', async () => {
    for (const f of ['payments.csv', 'attendance.csv']) {
      expect((await request(app).get(`/api/admin/export/${f}`).set('Authorization', `Bearer ${a.adminToken}`)).status).toBe(200);
      expect((await request(app).get(`/api/admin/export/${f}`)).status).toBe(401);
    }
  });

  test('an expired (read-only) gym can still export its data', async () => {
    const Subscriber = require('../models/Subscriber');
    const e = await createTenant({ gymName: 'Expired Gym' });
    await Subscriber.updateOne({ _id: e.subscriber._id }, { $set: { trialEndsAt: new Date(Date.now() - 5 * 86400000) }, $unset: { platformPlanId: 1, planStartedAt: 1 } });
    const r = await request(app).get('/api/admin/export/members.csv').set('Authorization', `Bearer ${e.adminToken}`);
    expect(r.status).toBe(200);
  });
});
