const { createSender, normalizePhone, inQuietHours } = require('../src/sender');
const afra = require('../src/afraTemplates');
const product = require('../src/productTemplates');

const DAY = new Date('2026-11-16T06:30:00Z'); // 12:00 IST
const NIGHT = new Date('2026-11-16T17:00:00Z'); // 22:30 IST
const ENV_LIVE = { WHATSAPP_PHONE_NUMBER_ID: '123', WHATSAPP_ACCESS_TOKEN: 'tok_secret_value', WHATSAPP_SENDING: 'on' };
const mk = (env, over = {}) => { const calls = []; const logs = []; const http = over.http || { post: async (url, body, opt) => { calls.push({ url, body, opt }); return { data: {} }; } };
  return { calls, logs, s: createSender({ http, env, now: () => DAY, log: (m) => logs.push(m), ...over }) }; };
const ask = (s, extra = {}) => s.sendTemplate({ templates: afra.TEMPLATES, template: 'afra_callback', params: { name: 'Ravi', product: 'Fit', day: 'Friday', phone: '98' }, to: '9876543210', consent: true, ...extra });

describe('shared WhatsApp sender', () => {
  test('phone numbers: 10 digits get 91, longer ones keep their code, rubbish is refused', () => {
    expect(normalizePhone('98765 43210')).toBe('919876543210'); expect(normalizePhone('+44 7700 900123')).toBe('447700900123'); expect(normalizePhone('123')).toBe(null);
  });
  test('quiet hours are 9 pm to 8 am Indian time', () => { expect(inQuietHours(NIGHT)).toBe(true); expect(inQuietHours(DAY)).toBe(false); expect(inQuietHours(new Date('2026-11-16T02:29:00Z'))).toBe(true); expect(inQuietHours(new Date('2026-11-16T02:31:00Z'))).toBe(false); });
  test('no credentials: demo only, nothing sent, phone masked in the log', async () => {
    const { s, calls, logs } = mk({}); const r = await ask(s);
    expect(r).toEqual({ ok: true, demo: true }); expect(calls.length).toBe(0); expect(logs[0]).toContain('*******3210'); expect(logs[0]).not.toContain('9876543210');
  });
  test('credentials but WHATSAPP_SENDING not on: still demo', async () => {
    const { s, calls } = mk({ ...ENV_LIVE, WHATSAPP_SENDING: 'off' }); expect((await ask(s)).demo).toBe(true); expect(calls.length).toBe(0);
  });
  test('live: posts the approved template with parameters in order, token only in the header', async () => {
    const { s, calls } = mk(ENV_LIVE); const r = await ask(s);
    expect(r).toEqual({ ok: true, demo: false }); expect(calls.length).toBe(1);
    expect(calls[0].url).toBe('https://graph.facebook.com/v21.0/123/messages');
    expect(calls[0].body.to).toBe('919876543210'); expect(calls[0].body.template.name).toBe('afra_callback');
    expect(calls[0].body.template.components[0].parameters.map((p) => p.text).join('|')).toBe('Ravi|Fit|Friday|98');
    expect(JSON.stringify(calls[0].body)).not.toContain('tok_secret_value'); expect(calls[0].opt.headers.Authorization).toBe('Bearer tok_secret_value');
  });
  test('refuses without consent, for an unknown template and for a bad number', async () => {
    const { s, calls } = mk(ENV_LIVE);
    expect((await ask(s, { consent: undefined })).error).toBe('no_consent'); expect((await ask(s, { consent: 'yes' })).error).toBe('no_consent');
    expect((await ask(s, { template: 'nope' })).error).toBe('unknown_template'); expect((await ask(s, { to: '12' })).error).toBe('invalid_phone');
    expect(calls.length).toBe(0);
  });
  test('quiet hours block a message unless allowQuiet is set', async () => {
    const { s, calls } = mk(ENV_LIVE, { now: () => NIGHT }); expect((await ask(s)).error).toBe('quiet_hours'); expect(calls.length).toBe(0);
    expect((await ask(s, { allowQuiet: true })).ok).toBe(true); expect(calls.length).toBe(1);
  });
  test('a failing network never throws and the token never leaks into the error', async () => {
    const http = { post: async () => { const e = new Error('boom Bearer tok_secret_value'); e.response = { data: { error: { message: 'Template not approved' } } }; throw e; } };
    const { s } = mk(ENV_LIVE, { http }); const r = await ask(s); expect(r).toEqual({ ok: false, demo: false, error: 'Template not approved' });
    const http2 = { post: async () => { throw new Error('socket Bearer tok_secret_value closed'); } }; const r2 = await mk(ENV_LIVE, { http: http2 }).s.sendTemplate({ templates: afra.TEMPLATES, template: 'afra_callback', params: {}, to: '9876543210', consent: true });
    expect(r2.ok).toBe(false); expect(r2.error).not.toContain('tok_secret_value');
  });
  test('the same dedupe key is sent once', async () => {
    const seen = new Set(); const store = { has: async (k) => seen.has(k), add: async (k) => { seen.add(k); } };
    const { s, calls } = mk(ENV_LIVE, { store }); const a = await ask(s, { dedupeKey: 'appt-1' }); const b = await ask(s, { dedupeKey: 'appt-1' });
    expect(a.duplicate).toBe(undefined); expect(b.duplicate).toBe(true); expect(calls.length).toBe(1);
  });
  test('status never shows the token', () => { const { s } = mk(ENV_LIVE); expect(s.status()).toEqual({ configured: true, sending: true }); expect(mk({}).s.status()).toEqual({ configured: false, sending: false }); });
});

describe('draft product templates (not submitted to Meta)', () => {
  test('every one is consistent: right prefix, placeholders in order, sample matches, body fits Meta rules, no offer wording', () => {
    for (const [n, t] of Object.entries(product.TEMPLATES)) {
      expect(/^(groom|mart|dine|cloth|wash|hire)_[a-z_]+$/.test(n)).toBe(true);
      const nums = [...t.body.matchAll(/{{(\d+)}}/g)].map((m) => Number(m[1]));
      expect(nums.slice().sort((a, b) => a - b).join()).toBe(t.params.map((_, i) => i + 1).join()); // each used once (order of use may differ)
      expect(t.sample.length).toBe(t.params.length); expect(t.body.length < 500).toBe(true);
      expect(/^\s|\s$/.test(t.body)).toBe(false); expect(/^{{/.test(t.body) || /{{\d+}}$/.test(t.body)).toBe(false);
      expect(/discount|offer|guarantee|free gift|% off/i.test(t.body)).toBe(false);
      expect(['UTILITY', 'MARKETING']).toContain(t.category);
    }
  });
  test('each of the six products has at least one template and marketing ones are only come-back messages', () => {
    for (const p of ['groom', 'mart', 'dine', 'cloth', 'wash', 'hire']) expect(Object.keys(product.TEMPLATES).filter((n) => n.startsWith(p + '_')).length).toBeGreaterThan(0);
    expect(Object.entries(product.TEMPLATES).filter(([, t]) => t.category === 'MARKETING').every(([n]) => /come_back$/.test(n))).toBe(true);
  });
  test('a product template renders through the shared sender', async () => {
    const { s, logs } = mk({}); const r = await s.sendTemplate({ templates: product.TEMPLATES, template: 'mart_dues_reminder', params: { name: 'Ravi', shop: 'Kumar Stores', amount: 450, phone: '98' }, to: '9876543210', consent: true });
    expect(r.demo).toBe(true); expect(logs[0]).toContain('a payment of Rs 450 is pending at Kumar Stores');
  });
});
