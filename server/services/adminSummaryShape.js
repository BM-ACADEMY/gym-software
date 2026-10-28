// Pure part of the gym summary (no database), so it is unit tested without MongoDB.
// Pure: turns what the gym already computes into the shared shape. Unit tested without a database.
const shape = ({ overview, budget, aiCallsToday, whatsappToday, openTickets }, now = new Date()) => ({
  schema: 1,
  product: 'gym',
  at: now.toISOString(),
  currency: 'INR',
  businesses: {
    total: overview.totalGyms,
    trial: overview.counts.trial || 0,
    paying: overview.payingGyms,
    grace: overview.counts.grace || 0,
    expired: overview.counts.expired || 0,
    suspended: overview.counts.suspended || 0,
    signups7d: overview.newSignups7d,
  },
  mrr: overview.mrr,
  collectedThisMonth: overview.collectedThisMonth.withGst,
  endingSoon: (overview.trialsEndingSoon || []).slice(0, 20).map((r) => ({ name: r.gymName, kind: 'trial', daysLeft: r.daysLeft })),
  renewalsDue: (overview.renewalsDue || []).slice(0, 20).map((r) => ({ name: r.gymName, kind: 'renewal', daysLeft: r.daysLeft })),
  ai: { callsToday: aiCallsToday, costTodayInr: budget.spent, budgetInr: budget.budget, stopped: !!budget.stopped },
  whatsappSentToday: whatsappToday,
  openTickets,
});

module.exports = { shape };
