const S = require('../src');
describe('presets', () => {
  test('four presets; starting list is a copy with price 0 and INR; clinic follow-up has no cycle', () => {
    expect(S.presetKeys()).toEqual(['salon', 'spa', 'barber', 'clinic']);
    const a = S.startingServices('salon'); a[0].name = 'changed'; a[0].price = 99;
    expect(S.startingServices('salon')[0].name).toBe('Haircut');
    expect(S.startingServices('salon')[0].price).toBe(0);
    expect(S.startingServices('salon')[0].currency).toBe('INR');
    expect(S.startingServices('nope')).toBe(null);
    expect(S.PRESETS.barber.mode).toBe('queue');
    expect(S.PRESETS.clinic.services[1].cycleDays).toBe(null);
  });
});
describe('slots', () => {
  const win = [[600, 780], [1080, 1260]];
  test('all slots free: 30-minute visit every 30 minutes inside both windows', () => {
    const f = S.freeSlots({ windows: win, mins: 30 });
    expect(f.length).toBe(12); expect(f[0]).toBe(600); expect(f[5]).toBe(750); expect(f[6]).toBe(1080);
  });
  test('a booked visit removes every slot it overlaps, and a long visit cannot run past closing', () => {
    const f = S.freeSlots({ windows: [[600, 780]], booked: [{ start: 630, end: 690 }], mins: 60, step: 30 });
    expect(f).toEqual([690, 720]);
    expect(S.freeSlots({ windows: [[600, 780]], mins: 60, step: 30 })).toEqual([600, 630, 660, 690, 720]);
  });
  test('buffer widens the clash; notBefore hides past times; bad input gives nothing', () => {
    expect(S.freeSlots({ windows: [[600, 720]], booked: [{ start: 660, end: 690 }], mins: 30, buffer: 10 })).toEqual([600, 690]);
    expect(S.freeSlots({ windows: [[600, 720]], mins: 30, notBefore: 650 })).toEqual([660, 690]);
    expect(S.freeSlots({ windows: 'x', mins: 30 })).toEqual([]);
    expect(S.freeSlots({ windows: [[600, 720]], mins: 2.5 })).toEqual([]);
    expect(S.freeSlots({ windows: [[720, 600]], mins: 30 })).toEqual([]);
  });
  test('hasClash agrees with freeSlots at the edges; hhmm formats', () => {
    expect(S.hasClash(690, 30, [{ start: 630, end: 690 }])).toBe(false);
    expect(S.hasClash(689, 30, [{ start: 630, end: 690 }])).toBe(true);
    expect(S.hhmm(605)).toBe('10:05'); expect(S.hhmm(1080)).toBe('18:00');
  });
});
describe('commission', () => {
  const rules = { default: { type: 'percent', value: 30 }, byService: { colour: { type: 'percent', value: 20 } }, byStaff: { s2: { type: 'flat', value: 50 } }, byStaffService: { 's1:colour': { type: 'percent', value: 10 } } };
  test('most specific rule wins', () => {
    expect(S.commissionFor({ staffId: 's3', serviceKey: 'haircut', amount: 400 }, rules)).toBe(120);
    expect(S.commissionFor({ staffId: 's3', serviceKey: 'colour', amount: 1000 }, rules)).toBe(200);
    expect(S.commissionFor({ staffId: 's2', serviceKey: 'colour', amount: 1000 }, rules)).toBe(50);
    expect(S.commissionFor({ staffId: 's1', serviceKey: 'colour', amount: 1000 }, rules)).toBe(100);
  });
  test('whole rupees, never above the line, bad rules ignored, no rule gives 0', () => {
    expect(S.commissionFor({ staffId: 'a', serviceKey: 'x', amount: 333 }, { default: { type: 'percent', value: 33 } })).toBe(110);
    expect(S.commissionFor({ staffId: 'a', serviceKey: 'x', amount: 30 }, { default: { type: 'flat', value: 50 } })).toBe(30);
    expect(S.commissionFor({ staffId: 'a', serviceKey: 'x', amount: 100 }, { default: { type: 'percent', value: 150 } })).toBe(0);
    expect(S.commissionFor({ staffId: 'a', serviceKey: 'x', amount: 100 }, {})).toBe(0);
    expect(S.commissionFor({ staffId: 'a', serviceKey: 'x', amount: 10.5 }, rules)).toBe(0);
  });
  test('totals per staff', () => {
    expect(S.totalsByStaff([{ staffId: 's3', serviceKey: 'haircut', amount: 400 }, { staffId: 's3', serviceKey: 'colour', amount: 1000 }, { staffId: 's2', serviceKey: 'haircut', amount: 400 }, { serviceKey: 'haircut', amount: 400 }], rules)).toEqual({ s3: 320, s2: 50 });
  });
});
describe('win-back', () => {
  const today = '2026-11-12';
  const cs = [
    { id: 1, name: 'A', lastVisit: '2026-08-01', lastServiceKey: 'haircut' },
    { id: 2, name: 'B', lastVisit: '2026-09-20', lastServiceKey: 'haircut' },
    { id: 3, name: 'C', lastVisit: '2026-10-30', lastServiceKey: 'haircut' },
    { id: 4, name: 'D', lastVisit: '2026-08-01', lastServiceKey: 'haircut', doNotContact: true },
    { id: 5, name: 'E', lastVisit: '2026-09-20', lastServiceKey: 'haircut', nextBooking: '2026-11-15' },
    { id: 6, name: 'F', lastVisit: 'bad', lastServiceKey: 'haircut' },
    { id: 7, name: 'G', lastVisit: '2026-09-01', lastServiceKey: 'consult' },
  ];
  test('lapsed: 60 days or more, longest gap first, do-not-contact and bad dates left out', () => {
    expect(S.lapsed(cs, today).map((x) => x.id)).toEqual([1, 7]);
    expect(S.lapsed(cs, today)[0].daysAway).toBe(103);
  });
  test('due for rebooking: past cycle plus grace, skips booked, do-not-contact and services with no cycle', () => {
    const r = S.dueForRebook(cs, today, { haircut: 42, consult: null });
    expect(r.map((x) => x.id)).toEqual([1, 2]);
    expect(r[1].overdueDays).toBe(11);
    expect(S.dueForRebook(cs, today, { haircut: 42 }, 20).map((x) => x.id)).toEqual([1]);
  });
});
