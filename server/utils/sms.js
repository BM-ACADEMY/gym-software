const axios = require('axios');

// Generic SMS sender on the same BulkSMS API utils/otp.js uses for OTPs, kept
// as a standalone function (not shared code) so the already-verified OTP/auth
// path is never touched by later modules built on top of it.
const sendSms = async (phone, message) => {
  let url = process.env.BULKSMS_API_URL;
  if (!url) {
    console.warn('BULKSMS_API_URL is missing in .env — SMS not sent.');
    return { success: false, demo: true };
  }
  url = url.replace('{{phone}}', encodeURIComponent(phone)).replace('{{message}}', encodeURIComponent(message));
  await axios.get(url);
  return { success: true, demo: false };
};

module.exports = { sendSms };
