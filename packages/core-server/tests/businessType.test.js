const b = require('../src/businessType');

describe('business-type presets (C-05)', () => {
  test('every registered product has a valid default and well-formed presets', () => {
    for (const [product, cfg] of Object.entries(b.REGISTRY)) {
      expect(!!cfg.presets[cfg.defaultPreset]).toBe(true);
      for (const [k, p] of Object.entries(cfg.presets)) {
        expect(typeof p.label).toBe('string');
        expect(Array.isArray(p.menu) && p.menu.length > 0).toBe(true);
        expect(Array.isArray(p.reportPacks) && p.reportPacks.length > 0).toBe(true);
        expect(p.gst).toBe(null); // GST and SAC defaults wait for the CA (Tier 3)
      }
    }
  });
  test('salon product has the three presets of D-11', () => {
    expect(b.businessTypesFor('salon')).toEqual(['salon', 'spa', 'barber']);
    expect(b.resolvePreset('salon', 'barber').defaultMode).toBe('queue');
    expect(b.resolvePreset('salon', 'spa').defaultMode).toBe('appointment');
  });
  test('pub mode is a Dine preset', () => {
    expect(b.resolvePreset('dine', 'pub').pubMode).toBe(true);
    expect(b.resolvePreset('dine', 'cafe').pubMode).toBe(false);
  });
  test('unknown or missing type falls back to the product default and says so', () => {
    const p = b.resolvePreset('salon', 'zzz');
    expect(p.businessType).toBe('salon');
    expect(p.usedDefault).toBe(true);
    expect(b.resolvePreset('salon', undefined).usedDefault).toBe(true);
  });
  test('unknown product gives null', () => { expect(b.resolvePreset('nope', 'x')).toBe(null); });
  test('sign-up accepts only listed types', () => {
    expect(b.isValidBusinessType('dine', 'pub')).toBe(true);
    expect(b.isValidBusinessType('dine', 'barber')).toBe(false);
  });
  test('registering a broken product fails', () => {
    expect(() => b.registerProduct('x', { defaultPreset: 'a', presets: { b: { label: 'B', menu: [], reportPacks: [] } } })).toThrow(/defaultPreset/);
    expect(() => b.registerProduct('x', { defaultPreset: 'a', presets: { a: { label: 'A' } } })).toThrow(/needs label/);
  });
});
