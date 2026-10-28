const axios = require('axios');
const { orderedParams, render } = require('../config/whatsappTemplates');

// WhatsApp Cloud API (Meta). Business-initiated messages go out as approved
// templates only. Every function here NEVER throws: callers get
// { ok, demo, error } so one bad number can't stop a whole run.

// 10-digit Indian numbers get the 91 prefix; anything else must already carry a country code.
const normalizePhone = (phone, countryCode = '91') => {
  const digits = String(phone || '').replace(/\D/g, '');
  if (digits.length === 10) return `${countryCode}${digits}`;
  if (digits.length >= 11 && digits.length <= 15) return digits.replace(/^0+/, '');
  return null;
};

const credentials = () => ({
  phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID,
  accessToken: process.env.WHATSAPP_ACCESS_TOKEN,
});

const isConfigured = () => {
  const c = credentials();
  return Boolean(c.phoneNumberId && c.accessToken);
};

const sendTemplate = async ({ to, template, params, lang = process.env.WHATSAPP_TEMPLATE_LANG || 'en', countryCode = '91' }) => {
  const phone = normalizePhone(to, countryCode);
  if (!phone) return { ok: false, demo: false, error: 'invalid_phone' };

  if (!isConfigured()) {
    // Honest demo mode: nothing leaves the server, the text is only logged.
    console.log(`[DEMO WHATSAPP] to ${phone} | ${render(template, params)}`);
    return { ok: true, demo: true };
  }

  const { phoneNumberId, accessToken } = credentials();
  try {
    await axios.post(
      `https://graph.facebook.com/v21.0/${phoneNumberId}/messages`,
      {
        messaging_product: 'whatsapp',
        to: phone,
        type: 'template',
        template: {
          name: template,
          language: { code: lang },
          components: [{ type: 'body', parameters: orderedParams(template, params).map((text) => ({ type: 'text', text })) }],
        },
      },
      { headers: { Authorization: `Bearer ${accessToken}` }, timeout: 10000 }
    );
    return { ok: true, demo: false };
  } catch (err) {
    const detail = err.response?.data?.error?.message || err.message;
    return { ok: false, demo: false, error: String(detail).slice(0, 200) };
  }
};

module.exports = { normalizePhone, isConfigured, sendTemplate };
