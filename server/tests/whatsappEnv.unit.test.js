// AFRA Ventures number setup (27 Nov 2026): the server reads WA_* settings, the older WHATSAPP_* names still work,
// and the request matches Meta's template format. Fake values only; axios is mocked, nothing is sent.
jest.mock('axios', () => ({ post: jest.fn(() => Promise.resolve({ data: {} })) }));
const axios = require('axios');
const { sendTemplate, isConfigured } = require('../utils/whatsapp');
const { TEMPLATES, render } = require('../config/whatsappTemplates');

const NAMES = ['WA_TOKEN', 'WA_PHONE_NUMBER_ID', 'WA_TEMPLATE_LANG', 'WHATSAPP_ACCESS_TOKEN', 'WHATSAPP_PHONE_NUMBER_ID', 'WHATSAPP_TEMPLATE_LANG'];
const saved = {};
beforeEach(() => { for (const n of NAMES) { saved[n] = process.env[n]; delete process.env[n]; } axios.post.mockClear(); });
afterEach(() => { for (const n of NAMES) { if (saved[n] === undefined) delete process.env[n]; else process.env[n] = saved[n]; } });

describe('WhatsApp settings (AFRA Ventures number)', () => {
  test('WA_TOKEN and WA_PHONE_NUMBER_ID switch sending on and build the documented request', async () => {
    process.env.WA_TOKEN = 'fake_token'; process.env.WA_PHONE_NUMBER_ID = '111'; process.env.WA_TEMPLATE_LANG = 'en';
    expect(isConfigured()).toBe(true);
    const r = await sendTemplate({ to: '98765 43210', template: 'gymdesk_renewal_reminder', params: { name: 'Priya', gym: 'Fit Zone Gym', days: 3, phone: '9876543210' } });
    expect(r).toEqual({ ok: true, demo: false });
    const [url, body, opts] = axios.post.mock.calls[0];
    expect(url).toBe('https://graph.facebook.com/v21.0/111/messages');
    expect(opts.headers.Authorization).toBe('Bearer fake_token');
    expect(body).toEqual({
      messaging_product: 'whatsapp', to: '919876543210', type: 'template',
      template: { name: 'gymdesk_renewal_reminder', language: { code: 'en' }, components: [{ type: 'body', parameters: ['Priya', 'Fit Zone Gym', '3', '9876543210'].map((text) => ({ type: 'text', text })) }] },
    });
  });

  test('older WHATSAPP_* names still work; WA_* wins when both are set', async () => {
    process.env.WHATSAPP_ACCESS_TOKEN = 'old_token'; process.env.WHATSAPP_PHONE_NUMBER_ID = '222';
    await sendTemplate({ to: '9876543210', template: 'gymdesk_plan_expired', params: { name: 'A', gym: 'B', phone: '1' } });
    expect(axios.post.mock.calls[0][0]).toContain('/222/messages');
    process.env.WA_PHONE_NUMBER_ID = '111';
    await sendTemplate({ to: '9876543210', template: 'gymdesk_plan_expired', params: { name: 'A', gym: 'B', phone: '1' } });
    expect(axios.post.mock.calls[1][0]).toContain('/111/messages');
  });

  test('no settings: demo mode, nothing sent', async () => {
    expect(isConfigured()).toBe(false);
    expect((await sendTemplate({ to: '9876543210', template: 'gymdesk_winback', params: { name: 'A', gym: 'B', phone: '1' } })).demo).toBe(true);
    expect(axios.post).not.toHaveBeenCalled();
  });

  test('line breaks in values are removed (Meta refuses them)', async () => {
    process.env.WA_TOKEN = 't'; process.env.WA_PHONE_NUMBER_ID = '1';
    await sendTemplate({ to: '9876543210', template: 'gymdesk_winback', params: { name: 'A\nB', gym: 'G', phone: '1' } });
    expect(axios.post.mock.calls[0][1].template.components[0].parameters[0].text).toBe('A B');
  });

  test('the 8 approved templates, with the approved wording of the two reworded ones', () => {
    expect(Object.keys(TEMPLATES).sort()).toEqual(['gymdesk_absence_checkin', 'gymdesk_dues_reminder', 'gymdesk_owner_daily_summary', 'gymdesk_owner_monthly_report', 'gymdesk_owner_weekly_report', 'gymdesk_plan_expired', 'gymdesk_renewal_reminder', 'gymdesk_winback']);
    expect(render('gymdesk_renewal_reminder', { name: 'P', gym: 'G', days: 3, phone: '9' })).toMatch(/Questions\? Call 9 for help\.$/);
    expect(render('gymdesk_winback', { name: 'P', gym: 'G', phone: '9' })).toMatch(/Call 9 to book your visit\.$/);
    expect(['gymdesk_absence_checkin', 'gymdesk_plan_expired', 'gymdesk_winback'].map((n) => TEMPLATES[n].category)).toEqual(['MARKETING', 'MARKETING', 'MARKETING']);
  });
});
