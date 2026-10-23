require('dotenv').config();
const connectDB = require('./config/db');
const app = require('./app');
const { runAllRules } = require('./services/notifications');
const { runBillingCycle, runMemberAutoRenewals } = require('./services/billing');

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

connectDB();

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
