const Subscriber = require('../models/Subscriber');
const Admin = require('../models/Admin');
const { computeStatus } = require('./subscription');
const Member = require('../models/Member');
const Attendance = require('../models/Attendance');
const { shapeAccount } = require('./adminAccountsShape');

// Server-to-server only (behind INTERNAL_API_KEY). Contains owner phone and email: never log the result.
const buildAccounts = async (now = new Date()) => {
  const since14 = new Date(now.getTime() - 14 * 86400000);
  const [subs, owners, memberRows, checkinRows] = await Promise.all([
    Subscriber.find({}).select('gymName isActive trialEndsAt planStartedAt paidUntil planKey createdAt').limit(5000),
    Admin.find({ role: 'admin' }).sort({ createdAt: 1 }).select('subscriberId name phone email lastLoginAt salesContactOk'),
    Member.aggregate([{ $match: { status: { $ne: 'cancelled' } } }, { $group: { _id: '$subscriberId', n: { $sum: 1 } } }]),
    Attendance.aggregate([{ $match: { checkedInAt: { $gte: since14 } } }, { $group: { _id: '$subscriberId', n: { $sum: 1 } } }]),
  ]);
  const members = new Map(memberRows.map((r) => [String(r._id), r.n])); const checkins = new Map(checkinRows.map((r) => [String(r._id), r.n]));
  const firstOwner = new Map();
  for (const o of owners) { const k = String(o.subscriberId); if (!firstOwner.has(k)) firstOwner.set(k, o); }
  return subs.map((s) => shapeAccount({ subscriber: s, owner: firstOwner.get(String(s._id)), status: computeStatus(s, now), usage: { members: members.get(String(s._id)) || 0, checkins14: checkins.get(String(s._id)) || 0 } }));
};
module.exports = { buildAccounts };
