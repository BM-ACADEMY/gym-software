'use strict';
// One WhatsApp sender for every product, over Meta's WhatsApp Cloud API. WRITTEN, NOT YET TESTED against Meta.
// - Off until three things are all true: credentials are set, WHATSAPP_SENDING=on, and the caller says the person agreed (consent: true).
//   Anything else logs a masked demo line and sends nothing ("demo": true), so it is safe to wire in before the account is ready.
// - Approved templates only (the caller passes the template set, for example afraTemplates or productTemplates). No free text here.
// - Never throws: returns { ok, demo, duplicate, error }. The access token is never logged or returned.
// - Quiet hours 9 pm to 8 am IST: nothing goes out then unless allowQuiet is set (use that only for something the person is waiting for).
// - The HTTP client is passed in (axios-like { post }) so this package needs no dependency and tests need no network.
const { orderedParams, render } = require('./templateUtil');

const normalizePhone = (phone, countryCode = '91') => {
  const digits = String(phone || '').replace(/\D/g, '');
  if (digits.length === 10) return `${countryCode}${digits}`;
  if (digits.length >= 11 && digits.length <= 15) return digits.replace(/^0+/, '');
  return null;
};
const maskPhone = (p) => (p ? `${'*'.repeat(Math.max(0, p.length - 4))}${p.slice(-4)}` : '');
const istHour = (d) => new Date(d.getTime() + 330 * 60000).getUTCHours();
const inQuietHours = (d) => { const h = istHour(d); return h >= 21 || h < 8; };

function createSender({ http, env = process.env, now = () => new Date(), log = (m) => console.log(m), store = null, timeoutMs = 10000 }) {
  const cfg = () => ({ phoneNumberId: env.WHATSAPP_PHONE_NUMBER_ID, accessToken: env.WHATSAPP_ACCESS_TOKEN, live: env.WHATSAPP_SENDING === 'on', lang: env.WHATSAPP_TEMPLATE_LANG || 'en', version: env.WHATSAPP_API_VERSION || 'v21.0' });
  const status = () => { const c = cfg(); return { configured: Boolean(c.phoneNumberId && c.accessToken), sending: c.live }; };

  // templates: the set the template name belongs to. consent: must be exactly true. dedupeKey: optional, with a store { has(key), add(key) }.
  const sendTemplate = async ({ templates, template, params = {}, to, consent, lang, allowQuiet = false, dedupeKey = null, countryCode = '91' }) => {
    try {
      const t = templates && templates[template];
      if (!t) return { ok: false, demo: false, error: 'unknown_template' };
      if (consent !== true) return { ok: false, demo: false, error: 'no_consent' };
      const phone = normalizePhone(to, countryCode);
      if (!phone) return { ok: false, demo: false, error: 'invalid_phone' };
      if (!allowQuiet && inQuietHours(now())) return { ok: false, demo: false, error: 'quiet_hours' };
      if (dedupeKey && store) { if (await store.has(dedupeKey)) return { ok: true, demo: false, duplicate: true }; }
      const c = cfg();
      if (!(c.phoneNumberId && c.accessToken && c.live)) {
        log(`[DEMO WHATSAPP] to ${maskPhone(phone)} | ${template} | ${render(templates, template, params)}`);
        return { ok: true, demo: true };
      }
      await http.post(`https://graph.facebook.com/${c.version}/${c.phoneNumberId}/messages`, {
        messaging_product: 'whatsapp', to: phone, type: 'template',
        template: { name: template, language: { code: lang || c.lang }, components: [{ type: 'body', parameters: orderedParams(templates, template, params).map((text) => ({ type: 'text', text })) }] },
      }, { headers: { Authorization: `Bearer ${c.accessToken}` }, timeout: timeoutMs });
      if (dedupeKey && store) await store.add(dedupeKey);
      return { ok: true, demo: false };
    } catch (err) {
      const detail = (err && err.response && err.response.data && err.response.data.error && err.response.data.error.message) || (err && err.message) || 'send_failed';
      return { ok: false, demo: false, error: String(detail).replace(/Bearer\s+\S+/gi, 'Bearer ***').slice(0, 200) };
    }
  };
  return { sendTemplate, status };
}
module.exports = { createSender, normalizePhone, maskPhone, inQuietHours };
