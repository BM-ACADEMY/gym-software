// Owner autopilot reports: service around the pure rules in ownerReportRules.js. Every query filters by subscriberId.
// Suggest mode by default: a finished weekly or monthly report waits on the owner's screen and one tap sends it to the
// owner's own WhatsApp. If the owner turns on reportsAutoSend (and WhatsApp), it is sent by itself, once.
const mongoose = require('mongoose');
const Subscriber = require('../models/Subscriber');
const Admin = require('../models/Admin');
const Member = require('../models/Member');
const Payment = require('../models/Payment');
const Attendance = require('../models/Attendance');
const Expense = require('../models/Expense');
const OwnerReport = require('../models/OwnerReport');
const { computeStatus } = require('./subscription');
const { sendOnce, withinQuota } = require('./automations');
const R = require('./ownerReportRules');

const ACTIVE = ['active', 'expiring'];

// Flow numbers for [from, to): what happened in the period.
const gatherFlow = async (subscriberId, from, to) => {
  const [collectedAgg, expenseAgg, checkins, newMembers] = await Promise.all([
    Payment.aggregate([
      { $match: { subscriberId } }, { $unwind: '$installments' },
      { $match: { 'installments.paidAt': { $gte: from, $lt: to } } },
      { $group: { _id: null, total: { $sum: '$installments.amount' } } },
    ]),
    Expense.aggregate([{ $match: { subscriberId, date: { $gte: from, $lt: to } } }, { $group: { _id: null, total: { $sum: '$amount' } } }]),
    Attendance.countDocuments({ subscriberId, checkedInAt: { $gte: from, $lt: to } }),
    Member.countDocuments({ subscriberId, createdAt: { $gte: from, $lt: to } }),
  ]);
  return { collected: collectedAgg[0]?.total || 0, expenses: expenseAgg[0]?.total || 0, checkins, newMembers };
};

// Where things stand now (not a period total).
const gatherSnapshot = async (subscriberId, now) => {
  const [duesAgg, expiringNext7, activeMembers, lastSeen, active] = await Promise.all([
    Payment.aggregate([
      { $match: { subscriberId, status: { $in: ['pending', 'partial'] } } },
      { $group: { _id: null, total: { $sum: { $subtract: ['$amount', { $ifNull: ['$amountPaid', 0] }] } }, count: { $sum: 1 } } },
    ]),
    Member.countDocuments({ subscriberId, status: { $in: ACTIVE }, expiresAt: { $gt: now, $lte: new Date(now.getTime() + 7 * R.DAY) } }),
    Member.countDocuments({ subscriberId, status: { $in: ACTIVE }, expiresAt: { $gt: now } }),
    Attendance.aggregate([{ $match: { subscriberId } }, { $group: { _id: '$memberId', last: { $max: '$checkedInAt' } } }]),
    Member.find({ subscriberId, status: { $in: ACTIVE }, expiresAt: { $gt: now } }).select('createdAt').lean().limit(20000),
  ]);
  const lastBy = new Map(lastSeen.map((x) => [String(x._id), x.last]));
  const cutoff = now.getTime() - 10 * R.DAY;
  const absent10 = active.filter((m) => new Date(lastBy.get(String(m._id)) || m.createdAt).getTime() <= cutoff).length;
  return { duesTotal: duesAgg[0]?.total || 0, duesCount: duesAgg[0]?.count || 0, expiringNext7, absent10, activeMembers };
};

// Numbers for one period (finished, or partial = so far).
const buildReport = async (sub, period, now = new Date(), opts = {}) => {
  const range = R.periodRange(period, now, opts);
  const [cur, prev, snap] = await Promise.all([
    gatherFlow(sub._id, range.from, range.to),
    gatherFlow(sub._id, range.prevFrom, range.prevTo),
    gatherSnapshot(sub._id, now),
  ]);
  const data = R.buildData(cur, prev, snap, sub.currency || 'INR');
  return { period, key: range.key, label: range.label, partial: range.partial, data, headline: R.headline(data, period), step: R.nextStep(data) };
};

// The stored report for the last finished period. Made once; a repeat or a race returns the same one.
const ensureReport = async (sub, period, now = new Date()) => {
  const range = R.periodRange(period, now);
  const found = await OwnerReport.findOne({ subscriberId: sub._id, period, key: range.key });
  if (found) return found;
  const built = await buildReport(sub, period, now);
  try {
    return await OwnerReport.create({ subscriberId: sub._id, period, key: built.key, label: built.label, data: built.data });
  } catch (err) {
    if (err.code === 11000) return OwnerReport.findOne({ subscriberId: sub._id, period, key: range.key });
    throw err;
  }
};

const view = (doc, gymName) => {
  const o = doc.toObject ? doc.toObject() : doc;
  return { id: String(o._id), period: o.period, key: o.key, label: o.label, status: o.status, sentAt: o.sentAt || null, data: o.data, headline: R.headline(o.data, o.period), step: R.nextStep(o.data), text: R.toText(o, gymName) };
};

// Sends one report to the owner's WhatsApp with the approved template, once. Returns sent, demo, duplicate, failed, skipped or quota.
const sendReport = async (sub, owner, doc, now = new Date()) => {
  const name = R.templateName(doc.period);
  const params = R.templateParams(doc, sub.gymName);
  if (!sub.whatsappEnabled || !owner?.phone) return 'skipped';
  if (!(await withinQuota(sub, now))) return 'quota';
  const outcome = await sendOnce({
    sub, recipientType: 'admin', recipientId: owner._id, to: owner.phone, type: `owner_report_${doc.period}`, template: name, params,
    dedupeKey: `ownerreport:${doc.period}:${sub._id}:${doc.key}`, now,
  });
  if (outcome === 'sent' || outcome === 'demo' || outcome === 'duplicate') {
    await OwnerReport.updateOne({ _id: doc._id, status: { $ne: 'sent' } }, { $set: { status: 'sent', sentAt: now } });
  }
  return outcome;
};

// Job: make this period's reports for every live gym, and auto-send where the owner switched it on. Safe to run every 15 minutes.
const runOwnerReports = async ({ subscriberId, now = new Date() } = {}) => {
  const gyms = await Subscriber.find({ isActive: { $ne: false }, ...(subscriberId && { _id: subscriberId }) });
  const out = { made: 0, sent: 0 };
  for (const sub of gyms) {
    try {
      if (computeStatus(sub, now).readOnly) continue; // expired or suspended gyms get nothing
      const auto = sub.automations || {};
      for (const period of R.PERIODS) {
        if (auto[period === 'weekly' ? 'weeklyReport' : 'monthlyReport'] === false) continue;
        const existed = await OwnerReport.exists({ subscriberId: sub._id, period, key: R.periodRange(period, now).key });
        const doc = await ensureReport(sub, period, now);
        if (!existed) out.made += 1;
        if (doc.status === 'ready' && auto.reportsAutoSend === true && sub.whatsappEnabled) {
          const hour = new Date(now.getTime() + 5.5 * 3600000).getUTCHours();
          if (hour < 9 || hour >= 21) continue; // owner messages only 9:00 to 21:00 IST
          const owner = await Admin.findOne({ subscriberId: sub._id }).select('phone name');
          const r = await sendReport(sub, owner, doc, now);
          if (r === 'sent' || r === 'demo') out.sent += 1;
        }
      }
    } catch (err) {
      console.error(`Owner reports failed for gym ${sub._id}:`, err.message);
    }
  }
  return out;
};

const isId = (id) => mongoose.isValidObjectId(id) && String(new mongoose.Types.ObjectId(id)) === String(id);

module.exports = { buildReport, ensureReport, sendReport, runOwnerReports, view, isId, gatherFlow, gatherSnapshot };
