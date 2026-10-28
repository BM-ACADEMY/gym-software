// Database test. The Anthropic SDK is mocked: nothing is really sent anywhere.
const mockCreate = jest.fn();
jest.mock('@anthropic-ai/sdk', () => jest.fn().mockImplementation(() => ({ messages: { create: mockCreate } })));

const request = require('supertest');
const app = require('../app');
const db = require('./helpers/db');
const { createTenant, createMember } = require('./helpers/factories');
const Subscriber = require('../models/Subscriber');
const AiUsage = require('../models/AiUsage');

const DAY = 86400000;
const auth = (t) => ({ Authorization: `Bearer ${t.adminToken}` });
const reply = (text) => ({ stop_reason: 'end_turn', content: [{ type: 'text', text }] });

describe('Ask GymDesk + insights', () => {
  let t;
  beforeAll(async () => {
    await db.connect();
    t = await createTenant({ subscriber: { planKey: 'starter', paidUntil: new Date(Date.now() + 20 * DAY) } });
  });
  afterAll(async () => { delete process.env.ANTHROPIC_API_KEY; await db.clearDatabase(); await db.closeDatabase(); });
  beforeEach(() => { mockCreate.mockReset(); delete process.env.ANTHROPIC_API_KEY; });

  const ask = (tok, q) => request(app).post('/api/admin/assistant/ask').set(tok).send({ question: q });

  test('without an AI key it answers from matching help articles and costs nothing', async () => {
    const r = await ask(auth(t), 'how do I import members from excel');
    expect(r.status).toBe(200);
    expect(r.body.data.source).toBe('articles');
    expect(r.body.data.articles[0]).toBe('import');
    expect(mockCreate).not.toHaveBeenCalled();
    expect(await AiUsage.countDocuments({ subscriberId: t.subscriber._id })).toBe(0);
  });

  test('with a key it asks the model, records one use, and sends only articles + the question', async () => {
    process.env.ANTHROPIC_API_KEY = 'test-key';
    mockCreate.mockResolvedValue(reply('Go to Import Members and upload your Excel file.'));
    const r = await ask(auth(t), 'how do I import members');
    expect(r.body.data.source).toBe('ai');
    expect(r.body.data.answer).toMatch(/Import Members/);
    expect(await AiUsage.countDocuments({ subscriberId: t.subscriber._id, kind: 'assistant' })).toBe(1);
    const arg = mockCreate.mock.calls[0][0];
    expect(arg.system).toMatch(/ONLY from the help articles/);
    expect(arg.messages[0].content).toBe('how do I import members');
  });

  test('model failure falls back to articles and is not charged to the cap', async () => {
    process.env.ANTHROPIC_API_KEY = 'test-key';
    mockCreate.mockRejectedValue(new Error('network'));
    const before = await AiUsage.countDocuments({ subscriberId: t.subscriber._id });
    const r = await ask(auth(t), 'where is my gst invoice');
    expect(r.status).toBe(200);
    expect(r.body.data.source).toBe('articles');
    expect(await AiUsage.countDocuments({ subscriberId: t.subscriber._id })).toBe(before);
  });

  test('once the monthly cap is used, the model is not called any more', async () => {
    process.env.ANTHROPIC_API_KEY = 'test-key';
    const solo = await createTenant({ subscriber: { planKey: 'solo', paidUntil: new Date(Date.now() + 20 * DAY) } });
    await AiUsage.insertMany(Array.from({ length: 15 }, () => ({ subscriberId: solo.subscriber._id, kind: 'assistant' })));
    const r = await ask(auth(solo), 'how do I pay and renew');
    expect(r.body.data.source).toBe('articles');
    expect(r.body.data.remaining).toBe(0);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  test('bad input is rejected', async () => {
    expect((await ask(auth(t), 'hi')).status).toBe(400);
    expect((await ask(auth(t), 'x'.repeat(501))).status).toBe(400);
    expect((await request(app).post('/api/admin/assistant/ask').set(auth(t)).send({ question: { $gt: '' } })).status).toBe(400);
    expect((await request(app).post('/api/admin/assistant/ask').send({ question: 'how do I pay' })).status).toBe(401);
  });

  test('insights: rules fallback without a key, cached for the day, never mixes gyms', async () => {
    await createMember(t.subscriber, { name: 'Ravi', phone: '9000000011', expiresAt: new Date(Date.now() + 3 * DAY) });
    const other = await createTenant({ subscriber: { planKey: 'growth', paidUntil: new Date(Date.now() + 20 * DAY) } });
    const a = await request(app).get('/api/admin/assistant/insights').set(auth(t));
    expect(a.status).toBe(200);
    expect(a.body.data.source).toBe('rules');
    expect(a.body.data.summary).toMatch(/1 active members|active members/);
    expect(a.body.data.actions.join(' ')).toMatch(/1 membership/);
    const again = await request(app).get('/api/admin/assistant/insights').set(auth(t));
    expect(again.body.data.cached).toBe(true);
    const b = await request(app).get('/api/admin/assistant/insights').set(auth(other));
    expect(b.body.data.actions.join(' ')).not.toMatch(/1 membership/);
  });

  test('insights with a key: the model prompt holds numbers only, never names or phones', async () => {
    process.env.ANTHROPIC_API_KEY = 'test-key';
    mockCreate.mockResolvedValue(reply('{"summary":"Steady week.","actions":["Call expiring members","Chase dues"]}'));
    const g = await createTenant({ subscriber: { planKey: 'growth', paidUntil: new Date(Date.now() + 20 * DAY) } });
    await createMember(g.subscriber, { name: 'Secret Person', phone: '9111111111', expiresAt: new Date(Date.now() + 2 * DAY) });
    const r = await request(app).get('/api/admin/assistant/insights').set(auth(g));
    expect(r.body.data.source).toBe('ai');
    const sent = JSON.stringify(mockCreate.mock.calls[0][0]);
    expect(sent).not.toMatch(/Secret Person|9111111111/);
  });

  test('an AI insight is reused for the rest of the week (one paid call, not one a day)', async () => {
    process.env.ANTHROPIC_API_KEY = 'test-key';
    mockCreate.mockResolvedValue(reply('{"summary":"Fine week.","actions":["Do a thing"]}'));
    const g = await createTenant({ subscriber: { planKey: 'growth', paidUntil: new Date(Date.now() + 20 * DAY) } });
    const AiInsight = require('../models/AiInsight');
    const yesterday = new Date(Date.now() - DAY).toISOString().slice(0, 10);
    await AiInsight.create({ subscriberId: g.subscriber._id, day: yesterday, source: 'ai', summary: 'Old but recent', actions: ['x'] });
    const r = await request(app).get('/api/admin/assistant/insights').set(auth(g));
    expect(r.body.data.summary).toBe('Old but recent');
    expect(mockCreate).not.toHaveBeenCalled();
  });
});
