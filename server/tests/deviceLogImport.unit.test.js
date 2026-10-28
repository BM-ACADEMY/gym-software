const D = require('../services/deviceLogImport');

describe('device log parsing', () => {
  test('date formats are read in the gym time zone (IST)', () => {
    expect(D.parseDateTime('2026-12-01 06:15:32').toISOString()).toBe('2026-12-01T00:45:32.000Z');
    expect(D.parseDateTime('01/12/2026 6:15 PM').toISOString()).toBe('2026-12-01T12:45:00.000Z');
    expect(D.parseDateTime('01-12-2026 18:05').toISOString()).toBe('2026-12-01T12:35:00.000Z');
    expect(D.parseDateTime('12:30 AM, nonsense')).toBeNull();
    expect(D.parseDateTime('31/02/2026 10:00')).toBeNull();
    expect(D.parseDateTime('2026-12-01 12:05 AM').toISOString()).toBe('2026-11-30T18:35:00.000Z');
  });
  test('other time zones work', () => {
    expect(D.parseDateTime('2026-07-01 12:00', 'America/New_York').toISOString()).toBe('2026-07-01T16:00:00.000Z');
    expect(D.parseDateTime('2026-12-01 12:00', 'Asia/Dubai').toISOString()).toBe('2026-12-01T08:00:00.000Z');
  });
  test('headers: Date/Time column, or separate Date and Time', () => {
    const a = D.parseRows([{ 'User ID': '101', 'Date/Time': '2026-12-01 06:15:32' }, { 'User ID': '', 'Date/Time': '' }, { 'User ID': '102', 'Date/Time': 'bad' }]);
    expect(a.punches).toHaveLength(1);
    expect(a.errors).toHaveLength(1);
    const b = D.parseRows([{ ID: '7', Date: '01/12/2026', Time: '07:00:00' }]);
    expect(b.punches[0].at.toISOString()).toBe('2026-12-01T01:30:00.000Z');
  });
  test('fatal when columns are missing', () => {
    expect(D.parseRows([{ Foo: '1' }]).fatal).toMatch(/User ID/);
    expect(D.parseRows([{ 'User ID': '1' }]).fatal).toMatch(/Date/);
  });
  test('repeat punches within 30 minutes count once', () => {
    const t = (s) => D.parseDateTime(s);
    const { kept, duplicates } = D.collapse([
      { userId: '1', at: t('2026-12-01 06:00') }, { userId: '1', at: t('2026-12-01 06:10') }, { userId: '1', at: t('2026-12-01 18:00') },
      { userId: '2', at: t('2026-12-01 06:05') },
    ]);
    expect(kept).toHaveLength(3);
    expect(duplicates).toBe(1);
  });
});
