// Database test with a mocked email sender (nothing is really sent).
jest.mock('../utils/email', () => ({ sendEmail: jest.fn(async () => ({ success: true, demo: false })) }));

const db = require('./helpers/db');
const { createTenant } = require('./helpers/factories');
const { sendEmail } = require('../utils/email');
const { compose, runOwnerNotices } = require('../services/ownerNotices');
const BillingNotice = require('../models/BillingNotice');

const DAY = 86400000;
// 11:00 IST
const now = new Date('2026-12-01T05:30:00Z');

describe('compose (pure)', () => {
  const base = { gymName: 'Iron Gym', ownerName: 'Ravi', daysLeft: 3, endsAt: new Date('2026-12-04T00:00:00Z') };
  test('every kind has a subject, the gym name and a way to act', () => {
    for (const kind of ['trial_ending', 'renewal_due', 'grace', 'expired']) {
      const m = compose({ ...base, kind });
      expect(m.subject.length).toBeGreaterThan(10);
      expect(m.text).toMatch(/Iron Gym/);
      expect(m.text).toMatch(/billing|Plan & Billing/);
    }
  });
  test('says nothing renews by itself and never promises a feature we lack', () => {
    expect(compose({ ...base, kind: 'renewal_due' }).text).toMatch(/Nothing renews automatically/);
  });
  test('unknown kind gives null', () => { expect(compose({ ...base, kind: 'x' })).toBeNull(); });
});

describe('runOwnerNotices', () => {
  beforeAll(async () => { await db.connect(); });
  afterAll(async () => { await db.clearDatabase(); await db.closeDatabase(); });
  beforeEach(() => sendEmail.mockClear());

  test('emails a trial-ending owner once, even if the job runs twice', async () => {
    const t = await createTenant({ subscriber: { trialEndsAt: new Date(now.getTime() + 3 * DAY - 1000) }, admin: { email: `owner0@test.com` } });
    const a = await runOwnerNotices(now);
    const b = await runOwnerNotices(now);
    expect(a.sent).toBeGreaterThanOrEqual(1);
    expect(b.sent).toBe(0);
    const mine = sendEmail.mock.calls.filter((c) => /free trial ends/.test(c[1]));
    expect(mine).toHaveLength(1);
    expect(await BillingNotice.countDocuments({ subscriberId: t.subscriber._id, kind: 'trial_ending' })).toBe(1);
  });

  test('sends nothing at night (IST)', async () => {
    await createTenant({ subscriber: { trialEndsAt: new Date(now.getTime() + 1 * DAY - 1000) } });
    const r = await runOwnerNotices(new Date('2026-12-01T19:30:00Z')); // 01:00 IST
    expect(r.sent).toBe(0);
    expect(sendEmail).not.toHaveBeenCalled();
  });

  test('when email is not configured nothing is marked sent, so it retries later', async () => {
    sendEmail.mockResolvedValue({ success: false, demo: true });
    const t = await createTenant({ subscriber: { trialEndsAt: new Date(now.getTime() + 1 * DAY - 1000) }, admin: { email: `owner2@test.com` } });
    await runOwnerNotices(now);
    expect(await BillingNotice.countDocuments({ subscriberId: t.subscriber._id })).toBe(0);
    sendEmail.mockResolvedValue({ success: true, demo: false });
  });
});
