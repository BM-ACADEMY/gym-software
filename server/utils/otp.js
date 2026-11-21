const crypto = require('crypto');
const axios = require('axios');
const SystemSettings = require('../models/SystemSettings');

const isProduction = () => process.env.NODE_ENV === 'production';

// Cryptographically secure 6-digit code (Math.random is predictable).
const generateOtp = () => crypto.randomInt(100000, 1000000).toString();

// In production OTPs are ALWAYS sent for real. The demo mode (which prints the
// OTP and returns it in the API response) only exists for local development
// and the test suite, and the Root Admin "otp_mode" setting cannot turn it on
// in production.
const getOtpMode = async () => {
  if (isProduction()) return 'live';
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

  // Live mode: trigger the BulkSMS API. If it is not configured we fail
  // loudly — never silently fall back to demo, which would leak the OTP.
  const baseUrl = process.env.BULKSMS_API_URL;
  if (!baseUrl) {
    console.error('BULKSMS_API_URL is missing — cannot send OTP SMS.');
    throw new Error('SMS is not configured');
  }
  try {
    const url = baseUrl
      .replace('{{phone}}', encodeURIComponent(phone))
      .replace('{{message}}', encodeURIComponent(message));
    await axios.get(url, { timeout: 10000 });
    console.log(`[LIVE SMS] OTP sent to ${phone}.`);
    return { success: true, demo: false };
  } catch (error) {
    console.error('[LIVE SMS ERROR]:', error.message);
    throw new Error('Failed to send SMS OTP');
  }
};

const sendOtpEmail = async (email, otp) => {
  const mode = await getOtpMode();

  if (mode === 'demo') {
    console.log(`[DEMO EMAIL] To: ${email} | OTP: ${otp}`);
    return { success: true, otp, demo: true };
  }

  // Email delivery is not wired to an SMTP provider yet. Refuse instead of
  // pretending the email was sent.
  console.error('Email OTP requested but no SMTP provider is configured.');
  throw new Error('Email OTP is not available');
};

module.exports = {
  generateOtp,
  sendOtpSms,
  sendOtpEmail
};
