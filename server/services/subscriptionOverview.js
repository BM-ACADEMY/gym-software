const Subscriber = require('../models/Subscriber');
const Admin = require('../models/Admin');
const SubscriptionPayment = require('../models/SubscriptionPayment');
const { computeStatus, DAY } = require('./subscription');
const { getPlan } = require('../config/plans');
const AiUsage = require('../models/AiUsage');

// Monthly recurring revenue contribution of one paid gym, whole rupees excluding GST.
const mrrOf = (sub) => {
  const plan = getPlan(sub.planKey);
  if (!plan) return 0;
  return sub.billingCycle === 'yearly' ? Math.round(plan.yearly / 12) : plan.monthly;
};

const rowOf = (sub, now) => {
  const st = computeStatus(sub, now);
  return {
    id: sub._id,
    gymName: sub.gymName,
    status: st.status,
    planKey: st.planKey || null,
    billingCycle: sub.billingCycle || null,
    endsAt: st.endsAt || null,
    daysLeft: st.daysLeft ?? null,
    createdAt: sub.createdAt,
  };
};

const buildOverview = async (now = new Date()) => {
  const subs = await Subscriber.find({}).select('gymName isActive trialEndsAt planStartedAt paidUntil planKey billingCycle platformPlanId createdAt');
  const rows = subs.map((s) => ({ s, r: rowOf(s, now) }));

  const counts = { trial: 0, active: 0, grace: 0, expired: 0, suspended: 0 };
  let mrr = 0;
  let paying = 0;
  for (const { s, r } of rows) {
    counts[r.status] = (counts[r.status] || 0) + 1;
    if ((r.status === 'active' || r.status === 'grace') && s.paidUntil && s.planKey) {
      mrr += mrrOf(s);
      paying += 1;
    }
  }

  const within = (r, days) => r.daysLeft !== null && r.daysLeft <= days;
  const trialsEndingSoon = rows.filter(({ r }) => r.status === 'trial' && within(r, 3)).map(({ r }) => r);
  const renewalsDue = rows.filter(({ r }) => r.status === 'active' && r.planKey && within(r, 7)).map(({ r }) => r);
  const lapsed = rows.filter(({ r }) => r.status === 'grace' || r.status === 'expired').map(({ r }) => r);

  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const [recent, monthAgg, aiCalls] = await Promise.all([
    SubscriptionPayment.find({ status: 'paid' }).sort({ paidAt: -1 }).limit(10).select('subscriberId planKey cycle total invoiceNo paidAt buyerName'),
    SubscriptionPayment.aggregate([
      { $match: { status: 'paid', paidAt: { $gte: monthStart } } },
      { $group: { _id: null, taxable: { $sum: '$taxable' }, total: { $sum: '$total' }, count: { $sum: 1 } } },
    ]),
    AiUsage.aggregate([{ $match: { createdAt: { $gte: monthStart } } }, { $group: { _id: '$kind', n: { $sum: 1 } } }]),
  ]);

  const newSignups7d = rows.filter(({ s }) => now - s.createdAt <= 7 * DAY).length;

  return {
    totalGyms: subs.length,
    counts,
    mrr,
    arr: mrr * 12,
    payingGyms: paying,
    newSignups7d,
    collectedThisMonth: monthAgg[0] ? { taxable: monthAgg[0].taxable, withGst: monthAgg[0].total, payments: monthAgg[0].count } : { taxable: 0, withGst: 0, payments: 0 },
    aiCallsThisMonth: Object.fromEntries(aiCalls.map((x) => [x._id, x.n])),
    trialsEndingSoon,
    renewalsDue,
    lapsed,
    recentPayments: recent,
  };
};

// Who needs a billing message today. Used by the scheduler (n8n or cron) to send
// WhatsApp/email. kind: trial_ending (3 and 1 days), renewal_due (7 and 1 days),
// grace (in grace period), expired (just lapsed, within 14 days: win-back).
const buildReminders = async (now = new Date()) => {
  const subs = await Subscriber.find({ isActive: { $ne: false } }).select('gymName isActive trialEndsAt planStartedAt paidUntil planKey billingCycle');
  const owners = await Admin.find({ subscriberId: { $in: subs.map((s) => s._id) } }).select('subscriberId name phone email');
  const ownerBy = new Map(owners.map((o) => [String(o.subscriberId), o]));
  const out = [];
  for (const s of subs) {
    const st = computeStatus(s, now);
    let kind = null;
    if (st.status === 'trial' && [3, 1].includes(st.daysLeft)) kind = 'trial_ending';
    else if (st.status === 'active' && s.paidUntil && [7, 1].includes(st.daysLeft)) kind = 'renewal_due';
    else if (st.status === 'grace') kind = 'grace';
    else if (st.status === 'expired' && st.endsAt && now - st.endsAt <= 14 * DAY) kind = 'expired';
    if (!kind) continue;
    const o = ownerBy.get(String(s._id));
    out.push({
      subscriberId: s._id, gymName: s.gymName, kind, daysLeft: st.daysLeft ?? null, endsAt: st.endsAt || null,
      planKey: st.planKey || null, ownerName: o?.name || null, phone: o?.phone || null, email: o?.email || null,
    });
  }
  return out;
};

module.exports = { buildOverview, buildReminders, mrrOf };
