const { shape } = require('../services/adminSummaryShape');
const overview = { totalGyms: 12, counts: { trial: 5, active: 7, grace: 1 }, payingGyms: 7, newSignups7d: 3, mrr: 6993, collectedThisMonth: { withGst: 8000 },
  trialsEndingSoon: [{ gymName: 'Pulse Gym', daysLeft: 1, ownerPhone: '9876543210' }], renewalsDue: [], recentPayments: [{ buyerName: 'X', invoiceNo: 'I1' }] };
describe('admin summary shape', () => {
  const out = shape({ overview, budget: { spent: 41.5, budget: 500, stopped: false }, aiCallsToday: 38, whatsappToday: 310, openTickets: 2 }, new Date('2026-10-30T10:00:00Z'));
  test('has the agreed fields', () => {
    expect(out.schema).toBe(1); expect(out.product).toBe('gym'); expect(out.currency).toBe('INR');
    expect(out.businesses.total).toBe(12); expect(out.businesses.paying).toBe(7); expect(out.businesses.grace).toBe(1); expect(out.businesses.suspended).toBe(0);
    expect(out.mrr).toBe(6993); expect(out.ai.costTodayInr).toBe(41.5); expect(out.openTickets).toBe(2);
  });
  test('carries no personal data', () => {
    const s = JSON.stringify(out);
    expect(s).not.toMatch(/9876543210|ownerPhone|buyerName|invoiceNo/);
    expect(out.endingSoon[0]).toEqual({ name: 'Pulse Gym', kind: 'trial', daysLeft: 1 });
  });
});
