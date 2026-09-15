require('dotenv').config();
const connectDB = require('./config/db');
const app = require('./app');
const { runAllRules } = require('./services/notifications');
const { runBillingCycle, runMemberAutoRenewals } = require('./services/billing');

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
