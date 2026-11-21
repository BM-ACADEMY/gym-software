// Weekly owner coach (AI-05): service around the pure rules in ownerCoachRules.js. Every query filters by subscriberId.
const OwnerCoach = require('../models/OwnerCoach');
const GymPlan = require('../models/GymPlan');
const CopilotAction = require('../models/CopilotAction');
const aiAssist = require('./aiAssist');
const R = require('./ownerCoachRules');

const getCoach = async (sub, now = new Date()) => {
  const subscriberId = sub._id;
  const week = R.weekKey(now);
  let doc = await OwnerCoach.findOne({ subscriberId, week });
  if (!doc) {
    const [stats, plans] = await Promise.all([aiAssist.gatherStats(subscriberId, now), GymPlan.find({ subscriberId }).select('price durationDays').limit(50).lean()]);
    const actions = R.buildActions(stats, R.monthlyFee(plans), sub.currency || 'INR');
    try { doc = await OwnerCoach.create({ subscriberId, week, actions }); }
    catch (err) { if (err.code === 11000) doc = await OwnerCoach.findOne({ subscriberId, week }); else throw err; }
  }
  const rows = await CopilotAction.aggregate([{ $match: { subscriberId, createdAt: { $gte: R.weekStart(week) } } }, { $group: { _id: '$kind', n: { $sum: 1 } } }]);
  const taps = Object.fromEntries(rows.map((r) => [r._id, r.n]));
  return { week, actions: R.progress(doc.actions, taps) };
};
module.exports = { getCoach };
