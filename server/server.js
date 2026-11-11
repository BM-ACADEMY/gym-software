require('dotenv').config();
const connectDB = require('./config/db');
const app = require('./app');
const { runAllRules } = require('./services/notifications');
const { runWhatsappAutomations } = require('./services/automations');
const { runBillingCycle, runMemberAutoRenewals } = require('./services/billing');
const { runOwnerNotices } = require('./services/ownerNotices');

// Refuse to start in production with unsafe configuration. A weak JWT secret
// or a missing database URI would otherwise fail silently or insecurely.
if (process.env.NODE_ENV === 'production') {
  const problems = [];
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) problems.push('JWT_SECRET must be set and at least 32 characters');
  if (!process.env.MONGODB_URI) problems.push('MONGODB_URI is not set');
  if (problems.length) {
    console.error(`Refusing to start in production:\n - ${problems.join('\n - ')}`);
    process.exit(1);
  }
  if (!process.env.CORS_ORIGINS) console.warn('CORS_ORIGINS is not set — browsers on other origins (your web app) will be blocked.');
  if (!process.env.BULKSMS_API_URL) console.warn('BULKSMS_API_URL is not set — OTP SMS (sign-up, password reset, OTP login) will fail. Password login still works.');
}

// SET-01: plan prices and limits saved in Root Admin are laid over config/plans.js. Started before the database is ready;
// the first read waits for the connection, then it is re-read every minute so every server process stays in step.
const planSettings = require('./services/planSettings').init({ SystemSettings: require('./models/SystemSettings'), PLANS: require('./config/plans').PLANS });
Promise.resolve(connectDB()).then(() => { planSettings.load(); setInterval(() => planSettings.load(), 60 * 1000).unref(); });

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running in ${process.env.NODE_ENV} mode on port ${PORT}`);
});

// Auto-notification rules (plan expiring, payment overdue, PT session reminder)
// — runs platform-wide on a simple interval rather than a full job queue,
// which is enough for this stage; swap for a proper scheduler if volume grows.
const NOTIFICATION_RULES_INTERVAL_MS = 60 * 60 * 1000;
setTimeout(() => {
  runAllRules().catch((err) => console.error('Notification rules run failed:', err));
  runBillingCycle().catch((err) => console.error('Billing cycle run failed:', err));
  runMemberAutoRenewals().catch((err) => console.error('Member auto-renewal run failed:', err));
  setInterval(() => {
    runAllRules().catch((err) => console.error('Notification rules run failed:', err));
    runBillingCycle().catch((err) => console.error('Billing cycle run failed:', err));
    runMemberAutoRenewals().catch((err) => console.error('Member auto-renewal run failed:', err));
  }, NOTIFICATION_RULES_INTERVAL_MS);
}, 10000);

// WhatsApp automations (renewals, dues, absence, owner summary): every 15 minutes.
// Each message has a unique dedupe key, so overlapping or repeated runs never double-send.
setTimeout(() => {
  const tick = () => runWhatsappAutomations().catch((err) => console.error('WhatsApp automations run failed:', err));
  tick();
  setInterval(tick, 15 * 60 * 1000);
}, 20000);

// Billing emails to gym owners (trial ending, renewal due, grace, expired): same
// 15-minute tick, unique key per email, only 10:00 to 20:00 IST.
setTimeout(() => {
  const tick = () => runOwnerNotices().catch((err) => console.error('Owner notices run failed:', err));
  tick();
  setInterval(tick, 15 * 60 * 1000);
}, 30000);

// Founder daily brief email (SA-04): same 15-minute tick; sends once per IST day, 08:00 to 12:00.
setTimeout(() => {
  const { runFounderBrief } = require('./services/founderBrief');
  const tick = () => runFounderBrief().catch((err) => console.error('Founder brief run failed:', err));
  tick();
  setInterval(tick, 15 * 60 * 1000);
}, 40000);
