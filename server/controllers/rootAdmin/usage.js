// SA-03: AI and WhatsApp usage per business, cost from real tokens, and the platform daily AI budget.
const Subscriber = require('../../models/Subscriber');
const AiUsage = require('../../models/AiUsage');
const Notification = require('../../models/Notification');
const aiBudget = require('../../services/aiBudget');
const aiAssist = require('../../services/aiAssist');

const round2 = (n) => Math.round(n * 100) / 100;

// GET /api/root-admin/usage  -> every business, this month (UTC month, same as the caps)
exports.getUsage = async (req, res) => {
  try {
    const now = new Date();
    const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const [subs, aiRows, waRows, budget] = await Promise.all([
      Subscriber.find({}).select('gymName planKey platformPlanId trialEndsAt paidUntil').lean(),
      AiUsage.aggregate([
        { $match: { createdAt: { $gte: from } } },
        { $group: { _id: { s: '$subscriberId', m: '$model', k: '$kind' }, calls: { $sum: 1 }, inTokens: { $sum: '$inTokens' }, outTokens: { $sum: '$outTokens' } } },
      ]),
      Notification.aggregate([
        { $match: { channel: 'whatsapp', status: 'sent', createdAt: { $gte: from } } },
        { $group: { _id: '$subscriberId', sent: { $sum: 1 } } },
      ]),
      aiBudget.status(now),
    ]);

    const by = new Map();
    for (const r of aiRows) {
      const id = String(r._id.s);
      const e = by.get(id) || { capCalls: 0, planCalls: 0, inTokens: 0, outTokens: 0, costInr: 0 };
      if (r._id.k === 'plan') e.planCalls += r.calls; else e.capCalls += r.calls;
      e.inTokens += r.inTokens; e.outTokens += r.outTokens;
      e.costInr += aiBudget.costInr(r._id.m, r.inTokens, r.outTokens);
      by.set(id, e);
    }
    const wa = new Map(waRows.map((r) => [String(r._id), r.sent]));

    const businesses = subs.map((s) => {
      const e = by.get(String(s._id)) || { capCalls: 0, planCalls: 0, inTokens: 0, outTokens: 0, costInr: 0 };
      const cap = aiAssist.capFor(s, now);
      const pct = cap > 0 ? Math.round((e.capCalls / cap) * 100) : 0;
      return {
        id: s._id, name: s.gymName, product: 'gym', plan: s.planKey || null,
        aiCalls: e.capCalls, aiPlanCalls: e.planCalls, aiCap: cap, aiPercent: pct,
        alert: pct >= 100 ? 'at_cap' : pct >= 80 ? 'near_cap' : null,
        inTokens: e.inTokens, outTokens: e.outTokens, aiCostInr: round2(e.costInr),
        whatsappSent: wa.get(String(s._id)) || 0,
      };
    }).sort((a, b) => b.aiCostInr - a.aiCostInr);

    res.json({
      success: true,
      data: {
        month: from.toISOString().slice(0, 7), currency: 'INR',
        budget: { dailyInr: budget.budget, spentTodayInr: budget.spent, stopped: budget.stopped },
        totals: {
          aiCostInr: round2(businesses.reduce((s, b) => s + b.aiCostInr, 0)),
          aiCalls: businesses.reduce((s, b) => s + b.aiCalls + b.aiPlanCalls, 0),
          whatsappSent: businesses.reduce((s, b) => s + b.whatsappSent, 0),
          atOrNearCap: businesses.filter((b) => b.alert).length,
        },
        businesses,
      },
    });
  } catch (err) {
    console.error('usage overview failed:', err.message);
    res.status(500).json({ success: false, message: 'Could not load usage.' });
  }
};

// PUT /api/root-admin/usage/budget  { dailyInr }   0 switches AI off everywhere
exports.setBudget = async (req, res) => {
  const n = Number(req.body?.dailyInr);
  if (!Number.isFinite(n) || n < 0 || n > 100000) {
    return res.status(400).json({ success: false, message: 'Enter a daily budget in rupees between 0 and 100000.' });
  }
  const before = await aiBudget.getDailyBudget();
  await aiBudget.setDailyBudget(Math.round(n));
  aiBudget.resetCache();
  // The platform audit log needs a gym id, so this change is kept in the server log and in SystemSettings.updatedAt (SA-08 adds a platform log).
  console.log(`AI daily budget changed by root admin ${req.user.id}: ${before} -> ${Math.round(n)}`);
  res.json({ success: true, data: await aiBudget.status() });
};
