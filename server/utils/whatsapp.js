const axios = require('axios');

// WhatsApp Cloud API (Meta) sender — same honest demo/live pattern as
// utils/sms.js: no-ops with a console warning until a real WhatsApp Business
// number is configured via WHATSAPP_PHONE_NUMBER_ID/WHATSAPP_ACCESS_TOKEN.
const sendWhatsapp = async (phone, message) => {
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
  if (!phoneNumberId || !accessToken) {
    console.warn('WHATSAPP_PHONE_NUMBER_ID/WHATSAPP_ACCESS_TOKEN missing in .env — WhatsApp message not sent.');
    return { success: false, demo: true };
  }

  await axios.post(
    `https://graph.facebook.com/v19.0/${phoneNumberId}/messages`,
    { messaging_product: 'whatsapp', to: phone.replace(/\D/g, ''), type: 'text', text: { body: message } },
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  return { success: true, demo: false };
};

module.exports = { sendWhatsapp };
