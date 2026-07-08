const axios = require('axios');
const SystemSettings = require('../models/SystemSettings');

const generateOtp = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

const getOtpMode = async () => {
  try {
    return await SystemSettings.getSetting('otp_mode', process.env.OTP_MODE || 'demo');
  } catch {
    return process.env.OTP_MODE || 'demo';
  }
};

const sendOtpSms = async (phone, otp) => {
  const mode = await getOtpMode();
  const message = `Your GymDesk OTP is ${otp}. It is valid for 10 minutes.`;

  if (mode === 'demo') {
    console.log(`[DEMO SMS] To: ${phone} | OTP: ${otp}`);
    return { success: true, otp, demo: true };
  }

  // Live Mode: Trigger BulkSMS API
  try {
    let url = process.env.BULKSMS_API_URL;
    if (!url) {
      console.warn('BULKSMS_API_URL is missing in .env! Falling back to Demo.');
      return { success: true, otp, demo: true };
    }
    
    // Replace placeholders
    url = url.replace('{{phone}}', encodeURIComponent(phone));
    url = url.replace('{{message}}', encodeURIComponent(message));

    const response = await axios.get(url);
    console.log(`[LIVE SMS] Sent to ${phone}. Response: ${response.data}`);
    return { success: true, demo: false };
  } catch (error) {
    console.error(`[LIVE SMS ERROR]:`, error.message);
    throw new Error('Failed to send SMS OTP');
  }
};

const sendOtpEmail = async (email, otp) => {
  const mode = await getOtpMode();
  const message = `Your GymDesk OTP is ${otp}. It is valid for 10 minutes.`;

  if (mode === 'demo') {
    console.log(`[DEMO EMAIL] To: ${email} | OTP: ${otp}`);
    return { success: true, otp, demo: true };
  }

  // Live Mode: Mocked until SMTP config is provided
  console.log(`[LIVE EMAIL MOCK] Sending email to ${email} with message: ${message}`);
  return { success: true, demo: false };
};

module.exports = {
  generateOtp,
  sendOtpSms,
  sendOtpEmail
};
