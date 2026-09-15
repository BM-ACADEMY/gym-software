const nodemailer = require('nodemailer');

// Provider-agnostic: works with any SMTP account (Gmail app password, a
// domain's own SMTP, a transactional provider's SMTP relay, etc.) — no vendor
// SDK lock-in. Falls back to a warning (caller treats as demo) if unconfigured.
let transporter;
const getTransporter = () => {
  if (transporter) return transporter;
  if (!process.env.SMTP_HOST) return null;
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 587,
    secure: process.env.SMTP_SECURE === 'true',
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
  });
  return transporter;
};

const sendEmail = async (to, subject, message) => {
  const t = getTransporter();
  if (!t) {
    console.warn('SMTP_HOST is missing in .env — email not sent.');
    return { success: false, demo: true };
  }
  await t.sendMail({ from: process.env.SMTP_FROM || process.env.SMTP_USER, to, subject, text: message });
  return { success: true, demo: false };
};

module.exports = { sendEmail };
