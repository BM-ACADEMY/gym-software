// Database test. The AI provider layer is mocked: nothing is sent anywhere.
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
const Attendance = require('../models/Attendance');
const Payment = require('../models/Payment');
const AiUsage = require('../models/AiUsage');
const CopilotAction = require('../models/CopilotAction');

const DAY = 86400000;
const auth = (t) => ({ Authorization: `Bearer ${t.adminToken}` });
const future = (n) => new Date(Date.now() + n * DAY);

describe('Renewal Copilot', () => {
  let t; let other;
  beforeAll(async () => {
    await db.connect();
    t = await createTenant({ subscriber: { gymName: 'FitZone', planKey: 'growth', paidUntil: future(20) } });
    other = await createTenant({ subscriber: { gymName: 'Other Gym', planKey: 'growth', paidUntil: future(20) } });
  });
  afterAll(async () => { mockKeyOn = false; await db.clearDatabase(); await db.closeDatabase(); });
  beforeEach(() => { mockComplete.mockReset(); mockKeyOn = false; });

  const today = (tok, q = '') => request(app).get(`/api/admin/copilot/today${q}`).set(auth(tok));

  test('ranks the member whose plan ends soonest first, with reasons and a WhatsApp link', async () => {
    const soon = await createMember(t.subscriber, { name: 'Ravi Kumar', phone: '9876543210', expiresAt: future(2) });
    await createMember(t.subscriber, { name: 'Meena Devi', phone: '9876500000', expiresAt: future(12) });
    const r = await today(t);
    expect(r.status).toBe(200);
    expect(r.body.data.items[0].id).toBe(String(soon.member._id));
    expect(r.body.data.items[0].kind).toBe('renew');
    expect(r.body.data.items[0].message).toMatch(/Hi Ravi, your FitZone membership ends in 2 days/);
    expect(r.body.data.items[0].waLink).toMatch(/^https:\/\/wa\.me\/919876543210\?text=/);
    expect(r.body.data.items[0].reasons.length).toBeGreaterThan(0);
  });

  test('language switch gives Tamil and Hindi messages', async () => {
    const ta = await today(t, '?lang=ta');
    expect(ta.body.data.lang).toBe('ta');
    expect(ta.body.data.items[0].message).toMatch(/வணக்கம் Ravi/);
    const hi = await today(t, '?lang=hi');
    expect(hi.body.data.items[0].message).toMatch(/नमस्ते Ravi/);
  });

  test('overdue dues and absent members are listed; an opted-out member has no link', async () => {
    const owes = await createMember(t.subscriber, { name: 'Dues Person', phone: '9811111111', expiresAt: future(90) });
    await Payment.create({ subscriberId: t.subscriber._id, memberId: owes.member._id, amount: 1500, amountPaid: 500, status: 'partial', method: 'cash', dueDate: new Date(Date.now() - 6 * DAY) });
    const gone = await createMember(t.subscriber, { name: 'Gone Person', phone: '9822222222', expiresAt: future(90), notificationPreferences: { whatsapp: false } });
    await Attendance.create({ subscriberId: t.subscriber._id, memberId: gone.member._id, checkedInAt: new Date(Date.now() - 25 * DAY), method: 'manual' });
    const r = await today(t);
    const byName = Object.fromEntries(r.body.data.items.map((i) => [i.name, i]));
    expect(byName['Dues Person'].kind).toBe('dues');
    expect(byName['Dues Person'].params.amount).toBe(1000);
    expect(byName['Gone Person'].kind).toBe('absent');
    expect(byName['Gone Person'].waLink).toBeNull();
    expect(byName['Gone Person'].canOpen).toBe(false);
    expect(r.body.data.summary.totalDues).toBe(1000);
  });

  test('marking a member contacted hides that reason for a few days', async () => {
    const before = await today(t);
    const first = before.body.data.items[0];
    const done = await request(app).post('/api/admin/copilot/done').set(auth(t)).send({ memberId: first.id, kind: first.kind });
    expect(done.status).toBe(200);
    const after = await today(t);
    expect(after.body.data.items.find((i) => i.id === first.id && i.kind === first.kind)).toBeUndefined();
  });

  test('never shows or touches another gym\'s members', async () => {
    const theirs = await createMember(other.subscriber, { name: 'Secret Other', phone: '9833333333', expiresAt: future(1) });
    const mine = await today(t);
    expect(JSON.stringify(mine.body)).not.toMatch(/Secret Other/);
    const theirList = await today(other);
    expect(theirList.body.data.items.map((i) => i.name)).toContain('Secret Other');
    const hack = await request(app).post('/api/admin/copilot/done').set(auth(t)).send({ memberId: String(theirs.member._id), kind: 'renew' });
    expect(hack.status).toBe(404);
    expect(await CopilotAction.countDocuments({ memberId: theirs.member._id })).toBe(0);
  });

  test('bad input is rejected and anonymous calls are refused', async () => {
    expect((await request(app).post('/api/admin/copilot/done').set(auth(t)).send({ memberId: { $gt: '' }, kind: 'renew' })).status).toBe(400);
    expect((await request(app).post('/api/admin/copilot/done').set(auth(t)).send({ memberId: 'abc', kind: 'nope' })).status).toBe(400);
    expect((await request(app).get('/api/admin/copilot/today')).status).toBe(401);
  });

  test('AI rewrite off: standard message; on: one use counted and no member data sent', async () => {
    const off = await request(app).post('/api/admin/copilot/polish').set(auth(t)).send({ kind: 'renew', lang: 'en' });
    expect(off.body.data.source).toBe('template');
    expect(mockComplete).not.toHaveBeenCalled();
    mockKeyOn = true;
    mockComplete.mockResolvedValue({ text: 'Hello {name}! Your {gym} plan ends in {days} days. Renew today and keep going strong.', usage: { inTokens: 90, outTokens: 30 }, model: 'test-small' });
    const on = await request(app).post('/api/admin/copilot/polish').set(auth(t)).send({ kind: 'renew', lang: 'en', tone: 'short' });
    expect(on.body.data.source).toBe('ai');
    expect(await AiUsage.countDocuments({ subscriberId: t.subscriber._id, kind: 'copilot' })).toBe(1);
    const sent = JSON.stringify(mockComplete.mock.calls[0][0]);
    expect(sent).not.toMatch(/Ravi|9876543210|FitZone/);
  });

  test('an unusable AI rewrite falls back to the standard message and is not charged', async () => {
    mockKeyOn = true;
    mockComplete.mockResolvedValue({ text: 'Hello! Renew soon please thank you very much indeed.', usage: { inTokens: 1, outTokens: 1 }, model: 'x' });
    const before = await AiUsage.countDocuments({ subscriberId: t.subscriber._id });
    const r = await request(app).post('/api/admin/copilot/polish').set(auth(t)).send({ kind: 'dues' });
    expect(r.body.data.source).toBe('template');
    expect(await AiUsage.countDocuments({ subscriberId: t.subscriber._id })).toBe(before);
  });

  test('once the monthly AI cap is used the model is not called', async () => {
    mockKeyOn = true;
    const solo = await createTenant({ subscriber: { planKey: 'solo', paidUntil: future(20) } });
    await AiUsage.insertMany(Array.from({ length: 15 }, () => ({ subscriberId: solo.subscriber._id, kind: 'assistant' })));
    const r = await request(app).post('/api/admin/copilot/polish').set(auth(solo)).send({ kind: 'renew' });
    expect(r.body.data.source).toBe('template');
    expect(mockComplete).not.toHaveBeenCalled();
  });
});
