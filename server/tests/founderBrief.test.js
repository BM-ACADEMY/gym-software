// Database test. Email sending is mocked: nothing is sent.
const mockSend = jest.fn();
jest.mock('../utils/email', () => ({ sendEmail: (...a) => mockSend(...a) }));

const db = require('./helpers/db');
const { createTenant } = require('./helpers/factories');
const { runFounderBrief } = require('../services/founderBrief');

const at = (iso) => new Date(iso); // 03:00Z = 08:30 IST

describe('SA-04 founder daily brief', () => {
  beforeAll(async () => { await db.connect(); await createTenant({ subscriber: { gymName: 'FitZone' } }); });
  afterAll(async () => { delete process.env.FOUNDER_EMAIL; await db.clearDatabase(); await db.closeDatabase(); });
  beforeEach(() => { mockSend.mockReset(); mockSend.mockResolvedValue({ success: true }); process.env.FOUNDER_EMAIL = 'founder@example.com'; });

  test('does nothing without FOUNDER_EMAIL', async () => {
    delete process.env.FOUNDER_EMAIL;
    const r = await runFounderBrief(at('2026-10-29T03:00:00Z'));
    expect(r.sent).toBe(false);
    expect(mockSend).not.toHaveBeenCalled();
  });
  test('does nothing outside 08:00 to 12:00 IST', async () => {
    expect((await runFounderBrief(at('2026-10-29T01:00:00Z'))).sent).toBe(false); // 06:30 IST
    expect(mockSend).not.toHaveBeenCalled();
  });
  test('sends once per IST day even if run many times', async () => {
    const a = await runFounderBrief(at('2026-10-29T03:00:00Z'));
    const b = await runFounderBrief(at('2026-10-29T03:15:00Z'));
    expect(a.sent).toBe(true);
    expect(b.sent).toBe(false);
    expect(mockSend).toHaveBeenCalledTimes(1);
    expect(mockSend.mock.calls[0][0]).toBe('founder@example.com');
  });
  test('a failed send is retried on the next tick; next day sends again', async () => {
    mockSend.mockResolvedValueOnce({ success: false, demo: true });
    expect((await runFounderBrief(at('2026-10-30T03:00:00Z'))).sent).toBe(false);
    expect((await runFounderBrief(at('2026-10-30T03:15:00Z'))).sent).toBe(true);
    expect((await runFounderBrief(at('2026-10-31T03:00:00Z'))).sent).toBe(true);
  });
});
