const request = require('supertest');
const app = require('../app');
const db = require('./helpers/db');
const { createTenant } = require('./helpers/factories');
const Subscriber = require('../models/Subscriber');

describe('Gym settings: region and branding gate', () => {
  let gym;
  const put = (body) => request(app).put('/api/admin/settings/gym').set('Authorization', `Bearer ${gym.adminToken}`).send(body);
  const DAY = 24 * 3600 * 1000;

  beforeAll(async () => {
    await db.connect();
    gym = await createTenant({ gymName: 'Region Gym' });
    await Subscriber.findByIdAndUpdate(gym.subscriber._id, { planKey: 'growth', paidUntil: new Date(Date.now() + 30 * DAY), $unset: { platformPlanId: 1 } });
  });
  afterAll(async () => { await db.clearDatabase(); await db.closeDatabase(); });

  test('saves valid regional settings', async () => {
    const res = await put({ country: 'in', currency: 'inr', timezone: 'Asia/Kolkata', language: 'ta' });
    expect(res.status).toBe(200);
    expect(res.body.data.currency).toBe('INR');
    expect(res.body.data.language).toBe('ta');
  });

  test('rejects bad regional values', async () => {
    expect((await put({ timezone: 'Mars/Base' })).status).toBe(400);
    expect((await put({ currency: 'RUPEES' })).status).toBe(400);
    expect((await put({ language: 'fr' })).status).toBe(400);
  });

  test('Growth plan cannot change logo or colour, but can rename the gym', async () => {
    const blocked = await put({ brandColor: '#ff0000' });
    expect(blocked.status).toBe(403);
    expect(blocked.body.planUpgradeRequired).toBe(true);
    expect((await put({ gymName: 'Renamed Gym' })).status).toBe(200);
  });

  test('Pro plan can change branding; bad values are refused', async () => {
    await Subscriber.findByIdAndUpdate(gym.subscriber._id, { planKey: 'pro' });
    expect((await put({ brandColor: '#ff0000', logoUrl: 'https://example.com/logo.png' })).status).toBe(200);
    expect((await put({ logoUrl: 'javascript:alert(1)' })).status).toBe(400);
  });
});
