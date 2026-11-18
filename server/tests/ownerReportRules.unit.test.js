const R = require('../services/ownerReportRules');

describe('owner report periods (IST)', () => {
  test('weekly: last finished Monday to Sunday, compared with the week before', () => {
    const p = R.periodRange('weekly', new Date('2026-11-18T10:00:00Z')); // Wednesday
    expect(p.key).toBe('2026-11-09');
    expect(p.from.toISOString()).toBe('2026-11-08T18:30:00.000Z');
    expect(p.to.toISOString()).toBe('2026-11-15T18:30:00.000Z');
    expect(p.prevFrom.toISOString()).toBe('2026-11-01T18:30:00.000Z');
    expect(p.prevTo.toISOString()).toBe(p.from.toISOString());
    expect(p.label).toBe('9 Nov to 15 Nov');
  });
  test('Sunday 23:30 IST still reports the old finished week; Monday 00:01 IST moves on', () => {
    expect(R.periodRange('weekly', new Date('2026-11-15T18:00:00Z')).key).toBe('2026-11-02');
    expect(R.periodRange('weekly', new Date('2026-11-15T18:31:00Z')).key).toBe('2026-11-09');
  });
  test('monthly: last finished calendar month, including the January and December turns', () => {
    const p = R.periodRange('monthly', new Date('2026-11-18T10:00:00Z'));
    expect(p.key).toBe('2026-10'); expect(p.label).toBe('Oct 2026');
    expect(p.from.toISOString()).toBe('2026-09-30T18:30:00.000Z'); expect(p.to.toISOString()).toBe('2026-10-31T18:30:00.000Z');
    expect(p.prevFrom.toISOString()).toBe('2026-08-31T18:30:00.000Z');
    expect(R.periodRange('monthly', new Date('2027-01-10T00:00:00Z')).key).toBe('2026-12');
    expect(R.periodRange('monthly', new Date('2026-12-31T20:00:00Z')).key).toBe('2026-12'); // 1 Jan 01:30 IST reports December
    expect(R.periodRange('monthly', new Date('2026-12-31T20:00:00Z')).label).toBe('Dec 2026');
  });
  test('partial week is "so far" and compares with the same stretch of last week', () => {
    const now = new Date('2026-11-18T10:00:00Z');
    const p = R.periodRange('weekly', now, { partial: true });
    expect(p.partial).toBe(true); expect(p.from.toISOString()).toBe('2026-11-15T18:30:00.000Z'); expect(p.to.toISOString()).toBe(now.toISOString());
    expect(p.prevTo - p.prevFrom).toBe(p.to - p.from);
  });
  test('unknown period is refused', () => { expect(() => R.periodRange('daily')).toThrow(); });
});

describe('owner report numbers and words', () => {
  test('percent change never invents a number', () => {
    expect(R.pctChange(120, 100)).toBe(20); expect(R.pctChange(80, 100)).toBe(-20); expect(R.pctChange(100, 100)).toBe(0);
    expect(R.pctChange(50, 0)).toBeNull(); expect(R.pctChange(0, 0)).toBeNull(); expect(R.pctChange(NaN, 5)).toBeNull();
  });
  const snap = { duesTotal: 8500, duesCount: 4, expiringNext7: 9, absent10: 6, activeMembers: 80 };
  test('whole rupees, net is collected minus expenses, rows in a fixed order, currency kept', () => {
    const d = R.buildData({ collected: 42000.4, expenses: 30000, checkins: 310, newMembers: 6 }, { collected: 35000, expenses: 31000, checkins: 280, newMembers: 6 }, snap, 'INR');
    expect(d.currency).toBe('INR');
    expect(d.metrics.map((m) => m.key)).toEqual(['collected', 'expenses', 'net', 'newMembers', 'checkins']);
    const net = d.metrics.find((m) => m.key === 'net'); expect(net.value).toBe(12000); expect(net.prev).toBe(4000); expect(net.changePct).toBe(200);
    expect(d.metrics.every((m) => Number.isInteger(m.value))).toBe(true);
  });
  test('headline says up or down with the percent, and flags expenses above collections', () => {
    const d = R.buildData({ collected: 42000, expenses: 1000, checkins: 1, newMembers: 0 }, { collected: 35000, expenses: 0, checkins: 1, newMembers: 0 }, snap);
    expect(R.headline(d, 'weekly')).toBe('Rs 42,000 collected (up 20% on last week).');
    const bad = R.buildData({ collected: 1000, expenses: 5000, checkins: 0, newMembers: 0 }, { collected: 2000, expenses: 0, checkins: 0, newMembers: 0 }, snap);
    expect(R.headline(bad, 'monthly')).toMatch(/down 50% on last month.*expenses were Rs 4,000 higher/);
    const none = R.buildData({}, {}, snap); expect(R.headline(none, 'weekly')).toBe('No payments recorded.');
  });
  test('next step goes dues, then renewals, then absent, then a calm default; no names', () => {
    const mk = (s) => R.nextStep(R.buildData({}, {}, { duesTotal: 0, duesCount: 0, expiringNext7: 0, absent10: 0, activeMembers: 0, ...s }));
    expect(mk({ duesTotal: 8500, duesCount: 4 }).kind).toBe('dues'); expect(mk({ duesTotal: 8500, duesCount: 4 }).text).toMatch(/Rs 8,500 pending across 4 payments/);
    expect(mk({ expiringNext7: 1 }).text).toMatch(/1 membership ends/); expect(mk({ absent10: 2 }).kind).toBe('absent'); expect(mk({}).kind).toBe('none');
  });
  test('template parameters match the approved template and carry no personal data', () => {
    const { TEMPLATES, render } = require('../config/whatsappTemplates');
    const report = { period: 'weekly', label: '9 Nov to 15 Nov', data: R.buildData({ collected: 42000, expenses: 0, checkins: 310, newMembers: 6 }, {}, snap) };
    const params = R.templateParams(report, 'Iron House');
    expect(Object.keys(params).sort()).toEqual([...TEMPLATES[R.templateName('weekly')].params].sort());
    expect(render('gymdesk_owner_weekly_report', params)).toMatch(/^Weekly report for Iron House \(9 Nov to 15 Nov\): Rs 42000 collected, 6 new members, 310 check-ins, Rs 8500 dues pending\. Next step: Collect/);
    expect(R.templateName('monthly')).toBe('gymdesk_owner_monthly_report');
  });
});
