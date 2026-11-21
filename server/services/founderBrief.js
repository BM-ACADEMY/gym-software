// SA-04: one plain-text email to the founder every morning (about 08:00 IST).
// Facts only, from our own records. Sent once per IST day (claimed atomically, so a restart or two
// copies of the server cannot send it twice). Needs FOUNDER_EMAIL and SMTP settings; otherwise it is skipped.
const Subscriber = require('../models/Subscriber');
const SubscriptionPayment = require('../models/SubscriptionPayment');
const Ticket = require('../models/Ticket');
const SystemSettings = require('../models/SystemSettings');
const AiUsage = require('../models/AiUsage');
const { buildOverview } = require('./subscriptionOverview');
const aiBudget = require('./aiBudget');
const { sendEmail } = require('../utils/email');
const { istParts } = require('./automationRules');

const DAY = 86400000;
const KEY = 'founder_brief_last_day';
const rs = (n) => `Rs ${Math.round(n || 0).toLocaleString('en-IN')}`;

// Pure: risk lines from the numbers. Only things that need a decision or a look.
const risks = (s) => {
  const out = [];
  if (s.failedPayments24h > 0) out.push(`${s.failedPayments24h} failed subscription payment(s) in the last 24 hours. Check Billing & Invoices.`);
  if (s.lapsedGyms > 0) out.push(`${s.lapsedGyms} gym(s) are in grace or expired. A personal call can win some back.`);
  if (s.trialsEndingSoon > 0) out.push(`${s.trialsEndingSoon} trial(s) end within 3 days. Nudge them to pick a plan.`);
  if (s.openTickets > 0) out.push(`${s.openTickets} support ticket(s) are open.`);
  if (s.budget.stopped) out.push('The daily AI budget was reached: AI is switched off for today and rule-based answers are running.');
  else if (s.budget.dailyInr > 0 && s.budget.spentTodayInr >= 0.8 * s.budget.dailyInr) out.push('AI spend today is over 80% of the daily budget.');
  if (s.aiCostMonthInr > 0 && s.mrr > 0 && s.aiCostMonthInr > 0.1 * s.mrr) out.push(`AI cost this month (${rs(s.aiCostMonthInr)}) is more than 10% of monthly recurring revenue. Check the Usage screen.`);
  return out;
};

// Pure: the email text.
const compose = (s, now = new Date()) => {
  const date = now.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', weekday: 'long', day: 'numeric', month: 'long' });
  const lines = [
    `Good morning. Here is ${date}.`,
    '',
    'MONEY',
    `Monthly recurring revenue: ${rs(s.mrr)} from ${s.payingGyms} paying gym(s) (before GST)`,
    `Collected this month: ${rs(s.collectedMonthTaxable)} before GST, ${s.collectedMonthPayments} payment(s)`,
    '',
    'GYMS',
    `Total ${s.totalGyms}: ${s.counts.trial || 0} on trial, ${s.counts.active || 0} active, ${s.counts.grace || 0} in grace, ${s.counts.expired || 0} expired`,
    `New in the last 24 hours: ${s.newGyms24h.length}${s.newGyms24h.length ? ' (' + s.newGyms24h.slice(0, 5).join(', ') + ')' : ''}`,
    `New in the last 7 days: ${s.newSignups7d}`,
    '',
    'AI',
    `Today: ${rs(s.budget.spentTodayInr)} of ${rs(s.budget.dailyInr)} budget. This month: ${rs(s.aiCostMonthInr)}.`,
    '',
    'NEEDS A LOOK',
    ...(s.risks.length ? s.risks.map((r) => `- ${r}`) : ['- Nothing urgent.']),
    '',
    'Numbers come from our own records. This email never includes member names or phone numbers.',
  ];
  return { subject: `GymDesk daily brief: ${rs(s.mrr)} MRR, ${s.totalGyms} gyms${s.risks.length ? `, ${s.risks.length} to look at` : ''}`, text: lines.join('\n') };
};

const gather = async (now = new Date()) => {
  const since = new Date(now.getTime() - DAY);
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const [ov, newGyms, failed, openTickets, budget, aiRows] = await Promise.all([
    buildOverview(now),
    Subscriber.find({ createdAt: { $gte: since } }).select('gymName').limit(20).lean(),
    SubscriptionPayment.countDocuments({ status: 'failed', updatedAt: { $gte: since } }),
    Ticket.countDocuments({ status: { $in: ['open', 'in_progress'] } }),
    aiBudget.status(now),
    AiUsage.aggregate([{ $match: { createdAt: { $gte: monthStart } } }, { $group: { _id: '$model', i: { $sum: '$inTokens' }, o: { $sum: '$outTokens' } } }]),
  ]);
  const s = {
    totalGyms: ov.totalGyms, counts: ov.counts, mrr: ov.mrr, payingGyms: ov.payingGyms, newSignups7d: ov.newSignups7d,
    collectedMonthTaxable: ov.collectedThisMonth.taxable, collectedMonthPayments: ov.collectedThisMonth.payments,
    newGyms24h: newGyms.map((g) => g.gymName), failedPayments24h: failed, openTickets,
    lapsedGyms: ov.lapsed.length, trialsEndingSoon: ov.trialsEndingSoon.length,
    budget, aiCostMonthInr: aiRows.reduce((t, r) => t + aiBudget.costInr(r._id, r.i, r.o), 0),
  };
  s.risks = risks(s);
  return s;
};

// Claim today's send. Returns the previous value to restore on failure, or null if already claimed.
const claim = async (day) => {
  try {
    const prev = await SystemSettings.findOneAndUpdate({ key: KEY, value: { $ne: day } }, { $set: { value: day, description: 'IST day the founder brief was last sent' } }, { upsert: true, returnDocument: 'before' });
    return { prev: prev ? prev.value : '' };
  } catch (err) {
    if (err.code === 11000) return null; // someone else (or an earlier run) already holds today
    throw err;
  }
};

const runFounderBrief = async (now = new Date()) => {
  const to = process.env.FOUNDER_EMAIL;
  if (!to) return { sent: false, reason: 'FOUNDER_EMAIL not set' };
  const p = istParts(now);
  if (p.hour < 8 || p.hour >= 12) return { sent: false, reason: 'outside the 08:00 to 12:00 IST window' };
  const got = await claim(p.date);
  if (!got) return { sent: false, reason: 'already sent today' };
  try {
    const mail = compose(await gather(now), now);
    const out = await sendEmail(to, mail.subject, mail.text);
    if (!out.success) throw new Error('email not sent (SMTP not set up)');
    return { sent: true };
  } catch (err) {
    await SystemSettings.updateOne({ key: KEY }, { $set: { value: got.prev } }); // allow a retry on the next tick
    console.error('Founder brief failed:', err.message);
    return { sent: false, reason: err.message };
  }
};

module.exports = { risks, compose, gather, runFounderBrief };
