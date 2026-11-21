// Database test with a mocked WhatsApp sender (nothing is really sent).
jest.mock('../utils/whatsapp', () => ({
  ...jest.requireActual('../utils/whatsapp'),
  sendTemplate: jest.fn(async () => ({ ok: true, demo: false })),
}));

const db = require('./helpers/db');
const { createTenant, createMember: createMemberRaw } = require('./helpers/factories');
const { sendTemplate } = require('../utils/whatsapp');
const { runWhatsappAutomations } = require('../services/automations');
const Notification = require('../models/Notification');
const Member = require('../models/Member');
const Subscriber = require('../models/Subscriber');

const DAY = 86400000;
// 11:00 IST
const now = new Date('2026-12-01T05:30:00Z');
// Members are created at the test clock, not the real one, so the absence rule
// (10+ days since joining) doesn't depend on today's date.
const createMember = (sub, o = {}) => createMemberRaw(sub, { createdAt: now, ...o });

describe('WhatsApp automations', () => {
  beforeAll(async () => { await db.connect(); });
  afterAll(async () => { await db.clearDatabase(); await db.closeDatabase(); });
  beforeEach(() => sendTemplate.mockClear());

  const gym = (extra = {}) => createTenant({ subscriber: { whatsappEnabled: true, planKey: 'growth', paidUntil: new Date(now.getTime() + 30 * DAY), ...extra } });

  test('sends a 7-day renewal reminder once, even if the job runs twice', async () => {
    const t = await gym();
    await createMember(t.subscriber, { name: 'Ravi', phone: '9876543210', expiresAt: new Date(now.getTime() + 7 * DAY - 1000) });
    const first = await runWhatsappAutomations({ subscriberId: t.subscriber._id, now });
    const second = await runWhatsappAutomations({ subscriberId: t.subscriber._id, now });
    expect(first.sent).toBe(1);
    expect(second.sent).toBe(0);
    expect(second.duplicate).toBe(1);
    expect(sendTemplate).toHaveBeenCalledTimes(1);
    expect(sendTemplate.mock.calls[0][0].template).toBe('gymdesk_renewal_reminder');
  });

  test('sends nothing when WhatsApp is off, the member opted out, or the gym is locked', async () => {
    const off = await gym({ whatsappEnabled: false });
    await createMember(off.subscriber, { phone: '9000000001', expiresAt: new Date(now.getTime() + 7 * DAY - 1000) });
    const optedOut = await gym();
    await createMember(optedOut.subscriber, { phone: '9000000002', expiresAt: new Date(now.getTime() + 7 * DAY - 1000), notificationPreferences: { whatsapp: false } });
    const locked = await gym({ paidUntil: new Date(now.getTime() - 10 * DAY) });
    await createMember(locked.subscriber, { phone: '9000000003', expiresAt: new Date(now.getTime() + 7 * DAY - 1000) });
    await runWhatsappAutomations({ now });
    expect(sendTemplate).not.toHaveBeenCalled();
  });

  test('quiet hours: nothing to members at 2 am IST', async () => {
    const t = await gym();
    await createMember(t.subscriber, { phone: '9000000004', expiresAt: new Date(new Date('2026-11-30T20:30:00Z').getTime() + 7 * DAY - 1000) });
    await runWhatsappAutomations({ subscriberId: t.subscriber._id, now: new Date('2026-11-30T20:30:00Z') });
    expect(sendTemplate).not.toHaveBeenCalled();
  });

  test('a failed send is recorded and retried on the next run', async () => {
    const t = await gym();
    await createMember(t.subscriber, { phone: '9000000005', expiresAt: new Date(now.getTime() + 1 * DAY - 1000) });
    sendTemplate.mockResolvedValueOnce({ ok: false, error: 'bad number' });
    const a = await runWhatsappAutomations({ subscriberId: t.subscriber._id, now });
    expect(a.failed).toBe(1);
    const b = await runWhatsappAutomations({ subscriberId: t.subscriber._id, now });
    expect(b.sent).toBe(1);
    expect(await Notification.countDocuments({ subscriberId: t.subscriber._id, status: 'failed' })).toBe(1);
  });

  test('absence alert goes to members who have not visited for 10+ days', async () => {
    const t = await gym();
    const { member } = await createMember(t.subscriber, { phone: '9000000006', expiresAt: new Date(now.getTime() + 60 * DAY) });
    await Member.collection.updateOne({ _id: member._id }, { $set: { createdAt: new Date(now.getTime() - 30 * DAY) } });
    const r = await runWhatsappAutomations({ subscriberId: t.subscriber._id, now });
    expect(r.sent).toBe(1);
    expect(sendTemplate.mock.calls[0][0].template).toBe('gymdesk_absence_checkin');
  });

  test('plan quota stops sending once the monthly allowance is used', async () => {
    const t = await gym();
    await Subscriber.updateOne({ _id: t.subscriber._id }, { planKey: 'starter' });
    await Notification.insertMany(Array.from({ length: 300 }, (_, i) => ({
      subscriberId: t.subscriber._id, recipientType: 'member', recipientId: t.subscriber._id, type: 'x', channel: 'whatsapp', status: 'sent', createdAt: now,
    })));
    await createMember(t.subscriber, { phone: '9000000007', expiresAt: new Date(now.getTime() + 7 * DAY - 1000) });
    const r = await runWhatsappAutomations({ subscriberId: t.subscriber._id, now });
    expect(r.quota).toBe(1);
    expect(sendTemplate).not.toHaveBeenCalled();
  });

  test('Solo plan sends no WhatsApp at all, including the owner summary', async () => {
    const t = await gym({ planKey: 'solo' });
    await createMember(t.subscriber, { phone: '9000000008', expiresAt: new Date(now.getTime() + 7 * DAY - 1000) });
    await runWhatsappAutomations({ subscriberId: t.subscriber._id, now });
    await runWhatsappAutomations({ subscriberId: t.subscriber._id, now: new Date('2026-12-01T14:45:00Z') });
    expect(sendTemplate).not.toHaveBeenCalled();
  });

  test('owner gets one daily summary at 8 pm IST', async () => {
    const t = await gym();
    const at8pm = new Date('2026-12-01T14:45:00Z');
    await runWhatsappAutomations({ subscriberId: t.subscriber._id, now: at8pm });
    await runWhatsappAutomations({ subscriberId: t.subscriber._id, now: at8pm });
    const calls = sendTemplate.mock.calls.filter((c) => c[0].template === 'gymdesk_owner_daily_summary');
    expect(calls).toHaveLength(1);
  });
});
