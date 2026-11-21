// D-28 route test (needs MongoDB, written not yet run by a person).
const request = require('supertest');
const app = require('../app');
const db = require('./helpers/db');
const { createTenant, createRootAdmin } = require('./helpers/factories');
const SystemSettings = require('../models/SystemSettings');
const live = require('../services/siteContentLive');

describe('site content (Root Admin)', () => {
  let root;
  beforeAll(async () => { await db.connect(); root = await createRootAdmin(); live.init({ SystemSettings }); });
  afterAll(async () => { await live.get().reset('faq', 'test', 'cleanup after test'); await db.clearDatabase(); await db.closeDatabase(); });
  const R = () => ({ Authorization: `Bearer ${root.token || root.rootToken || root.adminToken}` });

  test('gym owners and signed-out visitors cannot read or change wording', async () => {
    const t = await createTenant();
    const body = { value: [{ q: 'Hacked?', a: 'yes' }], reason: 'attack attempt' };
    expect([401, 403]).toContain((await request(app).get('/api/root-admin/site-content')).status);
    expect([401, 403]).toContain((await request(app).get('/api/root-admin/site-content').set({ Authorization: `Bearer ${t.adminToken}` })).status);
    expect([401, 403]).toContain((await request(app).put('/api/root-admin/site-content/faq').set({ Authorization: `Bearer ${t.adminToken}` }).send(body)).status);
    expect([401, 403]).toContain((await request(app).post('/api/root-admin/site-content/faq/reset').set({ Authorization: `Bearer ${t.adminToken}` }).send({ reason: 'attack attempt' })).status);
  });
  test('needs a reason, refuses links and unbuilt promises, saves, shows on the public route, resets', async () => {
    const put = (value, reason) => request(app).put('/api/root-admin/site-content/faq').set(R()).send({ value, reason });
    expect((await put([{ q: 'Q', a: 'A' }])).status).toBe(400);
    expect((await put([{ q: 'Q', a: 'see http://x.in' }], 'link test')).status).toBe(400);
    expect((await put([{ q: 'Q', a: 'We offer unlimited AI' }], 'claim test')).status).toBe(400);
    expect((await request(app).put('/api/root-admin/site-content/whatsapp_templates').set(R()).send({ value: [], reason: 'template edit try' })).status).toBe(400);
    const ok = await put([{ q: 'How long is the trial?', a: 'It is {trialDays} days.' }], 'test wording change');
    expect(ok.status).toBe(200);
    const pub = await request(app).get('/api/public/site-content');
    expect(pub.status).toBe(200);
    expect(pub.body.data.faq[0].q).toBe('How long is the trial?');
    expect(pub.body.data.faq[0].a).toMatch(/It is \d+ days\./);
    expect(JSON.stringify(pub.body)).not.toMatch(/history|reason|test wording change/);
    expect((await request(app).post('/api/root-admin/site-content/faq/reset').set(R()).send({ reason: 'back to standard' })).status).toBe(200);
    expect((await request(app).get('/api/public/site-content')).body.data.faq.length).toBeGreaterThan(5);
  });
  test('public route needs no sign-in and has a short cache', async () => {
    const r = await request(app).get('/api/public/site-content');
    expect(r.status).toBe(200); expect(r.headers['cache-control']).toMatch(/max-age=60/);
  });
});
