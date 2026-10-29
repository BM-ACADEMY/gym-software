const Subscriber = require('../models/Subscriber');
const Admin = require('../models/Admin');
const { computeStatus } = require('./subscription');
const { shapeAccount } = require('./adminAccountsShape');

// Server-to-server only (behind INTERNAL_API_KEY). Contains owner phone and email: never log the result.
const buildAccounts = async (now = new Date()) => {
  const [subs, owners] = await Promise.all([
    Subscriber.find({}).select('gymName isActive trialEndsAt planStartedAt paidUntil planKey createdAt').limit(5000),
    Admin.find({ role: 'admin' }).sort({ createdAt: 1 }).select('subscriberId name phone email lastLoginAt salesContactOk'),
  ]);
  const firstOwner = new Map();
  for (const o of owners) { const k = String(o.subscriberId); if (!firstOwner.has(k)) firstOwner.set(k, o); }
  return subs.map((s) => shapeAccount({ subscriber: s, owner: firstOwner.get(String(s._id)), status: computeStatus(s, now) }));
};
module.exports = { buildAccounts };
