const Subscriber = require('../models/Subscriber');
const Admin = require('../models/Admin');
const Member = require('../models/Member');
const Payment = require('../models/Payment');
const Attendance = require('../models/Attendance');
const Notification = require('../models/Notification');
const { sendTemplate } = require('../utils/whatsapp');
const { render } = require('../config/whatsappTemplates');
const { computeStatus, effectivePlan } = require('./subscription');
const R = require('./automationRules');

const ACTIVE_STATUSES = ['active', 'expiring', 'expired'];

// Sends one approved template and records it. The Notification is created FIRST
// with a unique dedupeKey, so two overlapping runs can never both send the same
// reminder. A failed send releases the key so a later run can retry, but a
// recipient/type with 3 failures in 24h is left alone.
const sendOnce = async ({ sub, recipientType, recipientId, to, type, template, params, dedupeKey, now }) => {
  const recentFails = await Notification.countDocuments({
    recipientId, type, status: 'failed', createdAt: { $gte: new Date(now.getTime() - R.DAY) },
  });
  if (recentFails >= 3) return 'skipped';

  let record;
  try {
    record = await Notification.create({
      subscriberId: sub._id, recipientType, recipientId, type, channel: 'whatsapp', templateName: template,
      message: render(template, params), sentAt: now, status: 'sent', dedupeKey,
    });
  } catch (err) {
    if (err.code === 11000) return 'duplicate';
    throw err;
  }

  const result = await sendTemplate({ to, template, params });
  if (result.ok) {
    if (result.demo) await Notification.updateOne({ _id: record._id }, { $set: { status: 'demo' } });
    return result.demo ? 'demo' : 'sent';
  }
  await Notification.updateOne({ _id: record._id }, { $set: { status: 'failed', error: result.error }, $unset: { dedupeKey: '' } });
  return 'failed';
};

// Monthly WhatsApp allowance of the gym's plan (null = unlimited).
const withinQuota = async (sub, now) => {
  const plan = effectivePlan(sub, now);
  if (!plan || plan.whatsappPerMonth == null) return true;
  const monthStart = new Date(R.istDayStart(now));
  monthStart.setUTCDate(1);
  const used = await Notification.countDocuments({
    subscriberId: sub._id, channel: 'whatsapp', status: { $in: ['sent', 'demo'] }, createdAt: { $gte: monthStart },
  });
  return used < plan.whatsappPerMonth;
};

const tally = () => ({ sent: 0, demo: 0, failed: 0, duplicate: 0, skipped: 0, quota: 0 });
const bump = (t, outcome) => { t[outcome] = (t[outcome] || 0) + 1; };

const memberOptedIn = (m) => m.phone && m.notificationPreferences?.whatsapp !== false;

const runRenewals = async (sub, ctx, t) => {
  const members = await Member.find({
    subscriberId: sub._id, status: { $in: ACTIVE_STATUSES },
    expiresAt: { $gte: new Date(ctx.now.getTime() - 9 * R.DAY), $lte: new Date(ctx.now.getTime() + 31 * R.DAY) },
  });
  for (const m of members) {
    if (!memberOptedIn(m)) continue;
    const st = R.renewalStage(m.expiresAt, ctx.now);
    if (!st) continue;
    if (!(await withinQuota(sub, ctx.now))) { bump(t, 'quota'); return; }
    bump(t, await sendOnce({
      sub, recipientType: 'member', recipientId: m._id, to: m.phone, type: `renewal_${st.stage}`, template: st.template,
      params: { name: m.name, gym: sub.gymName, days: st.days, phone: ctx.ownerPhone },
      dedupeKey: R.renewalKey(m._id, m.expiresAt, st.stage), now: ctx.now,
    }));
  }
};

const runDues = async (sub, ctx, t) => {
  const payments = await Payment.find({ subscriberId: sub._id, status: { $in: ['pending', 'partial'] }, dueDate: { $lt: ctx.now } }).populate('memberId');
  for (const p of payments) {
    const m = p.memberId;
    if (!m || !memberOptedIn(m)) continue;
    const st = R.duesStage(p.dueDate, ctx.now);
    const balance = p.amount - (p.amountPaid || 0);
    if (!st || balance <= 0) continue;
    if (!(await withinQuota(sub, ctx.now))) { bump(t, 'quota'); return; }
    bump(t, await sendOnce({
      sub, recipientType: 'member', recipientId: m._id, to: m.phone, type: 'dues_reminder', template: 'gymdesk_dues_reminder',
      params: { name: m.name, gym: sub.gymName, amount: balance, upi: sub.upiId || 'the front desk', phone: ctx.ownerPhone },
      dedupeKey: R.duesKey(p._id, st.week), now: ctx.now,
    }));
  }
};

const runAbsence = async (sub, ctx, t) => {
  const members = await Member.find({ subscriberId: sub._id, status: 'active', expiresAt: { $gt: ctx.now } });
  if (!members.length) return;
  const last = await Attendance.aggregate([
    { $match: { subscriberId: sub._id } },
    { $group: { _id: '$memberId', last: { $max: '$checkedInAt' } } },
  ]);
  const lastBy = new Map(last.map((x) => [String(x._id), x.last]));
  for (const m of members) {
    if (!memberOptedIn(m)) continue;
    const days = R.absenceDays(lastBy.get(String(m._id)), m.createdAt, ctx.now);
    if (days === null) continue;
    if (!(await withinQuota(sub, ctx.now))) { bump(t, 'quota'); return; }
    bump(t, await sendOnce({
      sub, recipientType: 'member', recipientId: m._id, to: m.phone, type: 'absence_checkin', template: 'gymdesk_absence_checkin',
      params: { name: m.name, gym: sub.gymName, days },
      dedupeKey: R.absenceKey(m._id, ctx.now), now: ctx.now,
    }));
  }
};

const runDailySummary = async (sub, ctx, t) => {
  if (!ctx.owner?.phone) return;
  if (!(await withinQuota(sub, ctx.now))) { bump(t, 'quota'); return; } // Solo plan has 0 messages
  const dayStart = R.istDayStart(ctx.now);
  const [checkins, collectedAgg, duesAgg, renewals] = await Promise.all([
    Attendance.countDocuments({ subscriberId: sub._id, checkedInAt: { $gte: dayStart } }),
    Payment.aggregate([
      { $match: { subscriberId: sub._id } },
      { $unwind: '$installments' },
      { $match: { 'installments.paidAt': { $gte: dayStart } } },
      { $group: { _id: null, total: { $sum: '$installments.amount' } } },
    ]),
    Payment.aggregate([
      { $match: { subscriberId: sub._id, status: { $in: ['pending', 'partial'] } } },
      { $group: { _id: null, total: { $sum: { $subtract: ['$amount', { $ifNull: ['$amountPaid', 0] }] } } } },
    ]),
    Member.countDocuments({ subscriberId: sub._id, status: { $in: ACTIVE_STATUSES }, expiresAt: { $gt: ctx.now, $lte: new Date(ctx.now.getTime() + 7 * R.DAY) } }),
  ]);
  bump(t, await sendOnce({
    sub, recipientType: 'admin', recipientId: ctx.owner._id, to: ctx.owner.phone, type: 'owner_daily_summary', template: 'gymdesk_owner_daily_summary',
    params: { gym: sub.gymName, checkins, collected: collectedAgg[0]?.total || 0, dues: duesAgg[0]?.total || 0, renewals },
    dedupeKey: R.summaryKey(sub._id, ctx.now), now: ctx.now,
  }));
};

// Runs all WhatsApp automations. Safe to call every 15 minutes: every message
// has a dedupe key. Pass subscriberId to run for one gym only.
const runWhatsappAutomations = async ({ subscriberId, now = new Date() } = {}) => {
  const query = { whatsappEnabled: true, isActive: { $ne: false }, ...(subscriberId && { _id: subscriberId }) };
  const gyms = await Subscriber.find(query);
  const totals = tally();

  for (const sub of gyms) {
    try {
      if (computeStatus(sub, now).readOnly) continue; // expired or suspended gyms send nothing
      const owner = await Admin.findOne({ subscriberId: sub._id }).select('phone name');
      const ctx = { now, owner, ownerPhone: owner?.phone || '-' };
      const auto = sub.automations || {};
      if (R.inSendWindow(now)) {
        if (auto.renewal !== false) await runRenewals(sub, ctx, totals);
        if (auto.dues !== false) await runDues(sub, ctx, totals);
        if (auto.absence !== false) await runAbsence(sub, ctx, totals);
      }
      if (R.isSummaryHour(now) && auto.dailySummary !== false) await runDailySummary(sub, ctx, totals);
    } catch (err) {
      console.error(`WhatsApp automations failed for gym ${sub._id}:`, err);
    }
  }
  return totals;
};

module.exports = { runWhatsappAutomations, sendOnce };
