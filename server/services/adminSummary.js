// SA-12 (gym side): the small, fixed summary every product exposes to the all-products Super Admin.
// Counts and rupee totals only. No member data, no owner phone or email. Contract version 1.
const AiUsage = require('../models/AiUsage');
const Notification = require('../models/Notification');
const Ticket = require('../models/Ticket');
const aiBudget = require('./aiBudget');
const { buildOverview } = require('./subscriptionOverview');
const { shape } = require('./adminSummaryShape');

const startOfUtcDay = (d) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));

const buildSummary = async (now = new Date()) => {
  const day = startOfUtcDay(now);
  const [overview, budget, aiCallsToday, whatsappToday, openTickets] = await Promise.all([
    buildOverview(now),
    aiBudget.status(now),
    AiUsage.countDocuments({ createdAt: { $gte: day } }),
    Notification.countDocuments({ channel: 'whatsapp', status: 'sent', createdAt: { $gte: day } }),
    Ticket.countDocuments({ status: { $in: ['open', 'in_progress'] } }),
  ]);
  return shape({ overview, budget, aiCallsToday, whatsappToday, openTickets }, now);
};

module.exports = { shape, buildSummary };
