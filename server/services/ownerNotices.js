const BillingNotice = require('../models/BillingNotice');
const Subscriber = require('../models/Subscriber');
const { buildReminders } = require('./subscriptionOverview');
const { sendEmail } = require('../utils/email');
const { istParts } = require('./automationRules');

const product = () => process.env.PRODUCT_NAME || 'GymDesk';
const appUrl = () => (process.env.CLIENT_URL || '').replace(/\/$/, '');
const billingLink = () => (appUrl() ? `${appUrl()}/admin/billing` : 'the Plan & Billing page in the app');
const day = (d) => (d ? new Date(d).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' }) : '');
const days = (n) => `${n} day${n === 1 ? '' : 's'}`;

// Pure: the email for one reminder. Plain text, no tracking, one clear action.
const compose = (r) => {
  const hi = `Hi ${r.ownerName || 'there'},`;
  const sign = `\n\n${product()} team`;
  switch (r.kind) {
    case 'trial_ending':
      return { subject: `Your ${product()} free trial ends in ${days(r.daysLeft)}`, text: `${hi}\n\nYour free trial for ${r.gymName} ends in ${days(r.daysLeft)} (${day(r.endsAt)}). After that your account becomes read-only: you can still see and export your data, but you cannot add or change anything.\n\nChoose a plan here: ${billingLink()}\nPlans start at Rs 249 a month. You pay in advance and nothing renews by itself.${sign}` };
    case 'renewal_due':
      return { subject: `Your ${product()} plan ends in ${days(r.daysLeft)}`, text: `${hi}\n\nYour plan for ${r.gymName} ends on ${day(r.endsAt)} (${days(r.daysLeft)} left). Nothing renews automatically. To keep going, pay for the next period here: ${billingLink()}\nPaying early adds time to your current end date, so you lose nothing.${sign}` };
    case 'grace':
      return { subject: `${product()}: please renew to avoid read-only mode`, text: `${hi}\n\nThe plan for ${r.gymName} has ended. You still have full access for ${days(r.daysLeft)}, then the account becomes read-only until you pay.\n\nRenew here: ${billingLink()}${sign}` };
    case 'expired':
      return { subject: `${product()}: your account is read-only`, text: `${hi}\n\nThe plan for ${r.gymName} ended on ${day(r.endsAt)}, so the account is read-only. Your data is safe and you can export it any time. To start adding and editing again, pay here: ${billingLink()}\n\nIf something is stopping you, reply to this email and tell us.${sign}` };
    default:
      return null;
  }
};

const keyFor = (r) => `${r.kind}:${r.subscriberId}:${r.kind === 'trial_ending' || r.kind === 'renewal_due' ? r.daysLeft : ''}:${day(r.endsAt)}`;

// Sends each due reminder once. Safe to call every 15 minutes: only runs between
// 10:00 and 19:59 IST and every email has a unique key.
const runOwnerNotices = async (now = new Date()) => {
  const h = istParts(now).hour;
  const result = { sent: 0, duplicate: 0, noEmail: 0, failed: 0, skipped: 0 };
  if (h < 10 || h >= 20) return result;

  const reminders = await buildReminders(now);
  for (const r of reminders) {
    if (!r.email) { result.noEmail++; continue; }
    const mail = compose(r);
    if (!mail) { result.skipped++; continue; }
    const key = keyFor(r);
    if (await BillingNotice.exists({ key })) { result.duplicate++; continue; }
    try {
      const out = await sendEmail(r.email, mail.subject, mail.text);
      if (!out.success) { result.failed++; continue; } // not configured: try again once SMTP is set
      try {
        await BillingNotice.create({ subscriberId: r.subscriberId, kind: r.kind, key, to: r.email });
      } catch (err) { if (err.code !== 11000) throw err; }
      result.sent++;
    } catch (err) {
      console.error('Owner notice failed:', err.message);
      result.failed++;
    }
  }
  return result;
};

// Best-effort welcome email after sign-up. Never throws.
const sendWelcome = async ({ subscriberId, email, ownerName, gymName }) => {
  try {
    const key = `welcome:${subscriberId}`;
    const text = `Hi ${ownerName || 'there'},\n\nWelcome to ${product()}. ${gymName} has a 14-day free trial with Growth features, no card needed.\n\nThree things to do first:\n1. Add your UPI ID and turn on WhatsApp reminders in Settings.\n2. Import your members from Excel (Import Members).\n3. Try Ask GymDesk on the Help & Support page if you get stuck.\n\nOpen the app: ${appUrl() || 'your GymDesk link'}\n\n${product()} team`;
    const out = await sendEmail(email, `Welcome to ${product()}`, text);
    if (out.success) await BillingNotice.create({ subscriberId, kind: 'welcome', key, to: email });
  } catch (err) {
    if (err.code !== 11000) console.warn('Welcome email failed:', err.message);
  }
};

module.exports = { compose, keyFor, runOwnerNotices, sendWelcome };
