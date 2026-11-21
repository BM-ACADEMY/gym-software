const R = require('../services/automationRules');
const { normalizePhone } = require('../utils/whatsapp');
const { TEMPLATES, render, orderedParams } = require('../config/whatsappTemplates');

const D = R.DAY;
// 11:00 IST on 1 Dec 2026
const noon = new Date('2026-12-01T05:30:00Z');

describe('renewal stages', () => {
  test('fires only on the 30, 7 and 1 day marks', () => {
    const at = (days) => new Date(noon.getTime() + days * D - 1000);
    expect(R.renewalStage(at(30), noon).stage).toBe('d30');
    expect(R.renewalStage(at(7), noon).stage).toBe('d7');
    expect(R.renewalStage(at(1), noon).stage).toBe('d1');
    expect(R.renewalStage(at(5), noon)).toBeNull();
    expect(R.renewalStage(at(15), noon)).toBeNull();
  });
  test('after the end: expired message on day 1, win-back on day 7', () => {
    expect(R.renewalStage(new Date(noon.getTime() - 1.5 * D), noon).template).toBe('gymdesk_plan_expired');
    expect(R.renewalStage(new Date(noon.getTime() - 7.5 * D), noon).template).toBe('gymdesk_winback');
    expect(R.renewalStage(new Date(noon.getTime() - 3.5 * D), noon)).toBeNull();
  });
  test('key is stable for the same membership period', () => {
    const exp = new Date('2026-12-08T00:00:00Z');
    expect(R.renewalKey('m1', exp, 'd7')).toBe('renewal:m1:2026-12-08:d7');
  });
});

describe('dues, absence, windows', () => {
  test('dues: nothing before it is late, weekly after, stops after 4', () => {
    expect(R.duesStage(new Date(noon.getTime() + D), noon)).toBeNull();
    expect(R.duesStage(new Date(noon.getTime() - 1.2 * D), noon).week).toBe(0);
    expect(R.duesStage(new Date(noon.getTime() - 8 * D), noon).week).toBe(1);
    expect(R.duesStage(new Date(noon.getTime() - 40 * D), noon)).toBeNull();
  });
  test('absence: needs 10 days, uses join date when never checked in', () => {
    expect(R.absenceDays(new Date(noon.getTime() - 5 * D), null, noon)).toBeNull();
    expect(R.absenceDays(new Date(noon.getTime() - 12 * D), null, noon)).toBe(12);
    expect(R.absenceDays(null, new Date(noon.getTime() - 20 * D), noon)).toBe(20);
    expect(R.absenceDays(null, null, noon)).toBeNull();
  });
  test('send window is 9:00 to 21:00 IST; summary at 20:00 IST', () => {
    expect(R.inSendWindow(new Date('2026-12-01T03:29:00Z'))).toBe(false); // 08:59 IST
    expect(R.inSendWindow(new Date('2026-12-01T03:30:00Z'))).toBe(true);  // 09:00 IST
    expect(R.inSendWindow(new Date('2026-12-01T15:30:00Z'))).toBe(false); // 21:00 IST
    expect(R.isSummaryHour(new Date('2026-12-01T14:45:00Z'))).toBe(true);  // 20:15 IST
    expect(R.isSummaryHour(new Date('2026-12-01T05:30:00Z'))).toBe(false);
  });
  test('IST day start', () => {
    expect(R.istDayStart(new Date('2026-12-01T20:00:00Z')).toISOString()).toBe('2026-12-01T18:30:00.000Z');
  });
});

describe('whatsapp helpers and templates', () => {
  test('phone numbers', () => {
    expect(normalizePhone('98765 43210')).toBe('919876543210');
    expect(normalizePhone('+91 98765-43210')).toBe('919876543210');
    expect(normalizePhone('12345')).toBeNull();
    expect(normalizePhone('')).toBeNull();
  });
  test('every template body uses exactly its listed parameters', () => {
    for (const [name, t] of Object.entries(TEMPLATES)) {
      const used = [...t.body.matchAll(/{{(\d+)}}/g)].map((m) => Number(m[1]));
      expect(Math.max(...used)).toBe(t.params.length);
      expect(new Set(used).size).toBe(t.params.length);
      expect(name.startsWith('gymdesk_')).toBe(true);
    }
  });
  test('render and ordered params', () => {
    const p = { name: 'Ravi', gym: 'Iron House', days: 7, phone: '9876543210' };
    expect(render('gymdesk_renewal_reminder', p)).toBe('Hi Ravi, your membership at Iron House ends in 7 day(s). Renew now to keep your access without a break. Questions? Call 9876543210.');
    expect(orderedParams('gymdesk_renewal_reminder', p)).toEqual(['Ravi', 'Iron House', '7', '9876543210']);
    expect(orderedParams('gymdesk_absence_checkin', { name: 'A\nB', gym: 'G', days: 11 })[0]).toBe('A B');
  });
});
