// Database test. AI provider mocked: nothing is sent anywhere.
const mockComplete = jest.fn();
let mockKeyOn = false;
jest.mock('../services/aiProvider', () => ({
  isEnabled: () => mockKeyOn,
  smallModel: () => 'gpt-5.4-nano',
  standardModel: () => 'gpt-5.4-mini',
  complete: (args) => mockComplete(args),
}));

const request = require('supertest');
const app = require('../app');
const db = require('./helpers/db');
const { createTenant, createRootAdmin } = require('./helpers/factories');
const AiUsage = require('../models/AiUsage');
const aiBudget = require('../services/aiBudget');

const DAY = 86400000;
const future = (n) => new Date(Date.now() + n * DAY);

describe('SA-03 usage screen and daily AI budget', () => {
  let t; let other; let root;
  beforeAll(async () => {
    await db.connect();
    t = await createTenant({ subscriber: { gymName: 'FitZone', planKey: 'starter', paidUntil: future(20) } });
    other = await createTenant({ subscriber: { gymName: 'Other Gym', planKey: 'starter', paidUntil: future(20) } });
    root = await createRootAdmin();
  });
  afterAll(async () => { mockKeyOn = false; await db.clearDatabase(); await db.closeDatabase(); });
  beforeEach(() => { mockComplete.mockReset(); mockKeyOn = false; aiBudget.resetCache(); });

  const rootAuth = () => ({ Authorization: `Bearer ${root.token}` });
  const ask = (tn, question) => request(app).post('/api/admin/assistant/ask').set({ Authorization: `Bearer ${tn.adminToken}` }).send({ question });

  test('only a root admin can see usage or change the budget', async () => {
    expect((await request(app).get('/api/root-admin/usage')).status).toBe(401);
    expect((await request(app).get('/api/root-admin/usage').set({ Authorization: `Bearer ${t.adminToken}` })).status).toBeGreaterThanOrEqual(401);
    expect((await request(app).put('/api/root-admin/usage/budget').set({ Authorization: `Bearer ${t.adminToken}` }).send({ dailyInr: 1 })).status).toBeGreaterThanOrEqual(401);
  });

  test('usage lists each business with its own tokens, cost and cap', async () => {
    await AiUsage.create({ subscriberId: t.subscriber._id, kind: 'assistant', model: 'gpt-5.4-nano', inTokens: 1000, outTokens: 100 });
    await AiUsage.create({ subscriberId: t.subscriber._id, kind: 'plan', model: 'gpt-5.4-mini', inTokens: 2000, outTokens: 1500 });
    const r = await request(app).get('/api/root-admin/usage').set(rootAuth());
    expect(r.status).toBe(200);
    const mine = r.body.data.businesses.find((b) => b.name === 'FitZone');
    const theirs = r.body.data.businesses.find((b) => b.name === 'Other Gym');
    expect(mine.aiCalls).toBe(1);        // plan call is not counted against the Ask cap
    expect(mine.aiPlanCalls).toBe(1);
    expect(mine.aiCap).toBe(40);         // Starter cap (D-16)
    expect(mine.aiCostInr).toBeGreaterThan(0);
    expect(theirs.aiCalls).toBe(0);
    expect(theirs.aiCostInr).toBe(0);
  });

  test('budget can be set, rejects bad values, and 0 stops AI everywhere', async () => {
    expect((await request(app).put('/api/root-admin/usage/budget').set(rootAuth()).send({ dailyInr: -5 })).status).toBe(400);
    expect((await request(app).put('/api/root-admin/usage/budget').set(rootAuth()).send({ dailyInr: 'abc' })).status).toBe(400);
    const ok = await request(app).put('/api/root-admin/usage/budget').set(rootAuth()).send({ dailyInr: 0 });
    expect(ok.status).toBe(200);
    expect(ok.body.data.stopped).toBe(true);
  });

  test('when the budget is reached AI is not called and answers fall back to help articles', async () => {
    mockKeyOn = true;
    await request(app).put('/api/root-admin/usage/budget').set(rootAuth()).send({ dailyInr: 0 });
    const r = await ask(t, 'how do I add a member?');
    expect(r.status).toBe(200);
    expect(mockComplete).not.toHaveBeenCalled();
    expect(r.body.data.source).toBe('articles');
  });

  test('with budget available AI is used again', async () => {
    mockKeyOn = true;
    await request(app).put('/api/root-admin/usage/budget').set(rootAuth()).send({ dailyInr: 100000 });
    mockComplete.mockResolvedValue({ text: 'Open Members and tap Add.', usage: { inTokens: 100, outTokens: 10 }, model: 'gpt-5.4-nano' });
    const r = await ask(other, 'how do I add a member?');
    expect(r.body.data.source).toBe('ai');
    expect(mockComplete).toHaveBeenCalled();
  });
});
