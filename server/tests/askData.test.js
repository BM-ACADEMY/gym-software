// Database test. AI provider mocked: nothing is sent anywhere.
const mockComplete = jest.fn();
let mockKeyOn = false;
jest.mock('../services/aiProvider', () => ({
  isEnabled: () => mockKeyOn,
  smallModel: () => 'test-small',
  standardModel: () => 'test-standard',
  complete: (args) => mockComplete(args),
}));

const request = require('supertest');
const app = require('../app');
const db = require('./helpers/db');
const { createTenant, createMember } = require('./helpers/factories');
const Payment = require('../models/Payment');
const AiUsage = require('../models/AiUsage');

const DAY = 86400000;
const auth = (t) => ({ Authorization: `Bearer ${t.adminToken}` });
const future = (n) => new Date(Date.now() + n * DAY);
const ask = (t, question) => request(app).post('/api/admin/assistant/ask').set(auth(t)).send({ question });

describe('Ask GymDesk on own data', () => {
  let t; let other;
  beforeAll(async () => {
    await db.connect();
    t = await createTenant({ subscriber: { gymName: 'FitZone', planKey: 'growth', paidUntil: future(20) } });
    other = await createTenant({ subscriber: { gymName: 'Other Gym', planKey: 'growth', paidUntil: future(20) } });
  });
  afterAll(async () => { mockKeyOn = false; await db.clearDatabase(); await db.closeDatabase(); });
  beforeEach(() => { mockComplete.mockReset(); mockKeyOn = false; });

  test('keyword question is answered from own data, free, no AI call', async () => {
    await createMember(t.subscriber, { name: 'Ravi Kumar', expiresAt: future(3) });
    await createMember(other.subscriber, { name: 'Secret Person', expiresAt: future(3) });
    const r = await ask(t, 'who is expiring in 7 days?');
    expect(r.status).toBe(200);
    expect(r.body.data.source).toBe('data');
    expect(r.body.data.answer).toContain('Ravi Kumar');
    expect(r.body.data.answer).not.toContain('Secret Person');
    expect(mockComplete).not.toHaveBeenCalled();
    expect(await AiUsage.countDocuments({ subscriberId: t.subscriber._id })).toBe(0);
  });

  test('dues are scoped to this gym', async () => {
    const m = (await createMember(t.subscriber, { name: 'Dues Dan' })).member;
    const o = (await createMember(other.subscriber, { name: 'Other Dues' })).member;
    await Payment.create({ subscriberId: t.subscriber._id, memberId: m._id, amount: 1000, amountPaid: 200, method: 'cash', status: 'partial', dueDate: new Date(Date.now() - 5 * DAY) });
    await Payment.create({ subscriberId: other.subscriber._id, memberId: o._id, amount: 5000, method: 'cash', status: 'pending', dueDate: new Date(Date.now() - 5 * DAY) });
    const r = await ask(t, 'show pending dues');
    expect(r.body.data.answer).toContain('Dues Dan');
    expect(r.body.data.answer).toContain('800');
    expect(r.body.data.answer).not.toContain('Other Dues');
  });

  test('AI routes an unmatched question; only the typed question is sent; counts toward cap', async () => {
    mockKeyOn = true;
    await createMember(t.subscriber, { name: 'Private Name', phone: '9000000001' });
    mockComplete.mockResolvedValue({ text: '{"tool":"member_count"}', usage: { inTokens: 50, outTokens: 5 }, model: 'test-small' });
    const r = await ask(t, 'give me the headcount please');
    expect(r.body.data.source).toBe('data');
    const sent = JSON.stringify(mockComplete.mock.calls[0][0]);
    expect(sent).not.toContain('Private Name');
    expect(sent).not.toContain('9000000001');
    const row = await AiUsage.findOne({ subscriberId: t.subscriber._id });
    expect(row.inTokens).toBe(50);
  });

  test('model proposing an unknown tool is ignored', async () => {
    mockKeyOn = true;
    mockComplete.mockResolvedValue({ text: '{"tool":"dropDatabase"}', usage: { inTokens: 1, outTokens: 1 }, model: 'test-small' });
    const r = await ask(t, 'xyzzy plugh');
    expect(r.status).toBe(200);
    expect(r.body.data.source).not.toBe('data');
  });
});
