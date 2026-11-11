import { describe, test, expect } from 'vitest';
import fs from 'node:fs';
import { setPath, pickTop, visibleFields, validateManifest } from '../src/admin/schema.js';
const fields = [{ key: 'discountRule.staff', label: 'Who', type: 'select', options: [{ value: 'any', label: 'Anyone' }, { value: 'limit', label: 'Up to a limit' }, { value: 'owner_only', label: 'Owner only' }] }, { key: 'discountRule.maxPercent', label: 'Max %', type: 'number', min: 0, max: 100, showWhen: { key: 'discountRule.staff', equals: 'limit' } }];
const code = (fn) => { try { fn(); } catch (e) { return e.code; } return 'none'; };
describe('settings screens with dotted fields', () => {
  test('setPath builds nested values without changing the input and refuses dangerous keys', () => {
    const a = { discountRule: { staff: 'limit', maxPercent: 10 }, other: 1 };
    const b = setPath(a, 'discountRule.staff', 'any');
    expect(b).toEqual({ discountRule: { staff: 'any', maxPercent: 10 }, other: 1 }); expect(a.discountRule.staff).toBe('limit');
    expect(setPath({}, 'x.y.z', 3)).toEqual({ x: { y: { z: 3 } } });
    expect(setPath({}, '__proto__.polluted', 1)).toEqual({}); expect(({}).polluted).toBe(undefined);
  });
  test('pickTop sends only the settings the screen owns', () => {
    expect(pickTop({ discountRule: { staff: 'any' }, gstBands: [1], growthPct: 5 }, fields)).toEqual({ discountRule: { staff: 'any' } });
  });
  test('the limit box shows only while "up to a limit" is chosen', () => {
    expect(visibleFields(fields, { discountRule: { staff: 'limit' } }).length).toBe(2);
    expect(visibleFields(fields, { discountRule: { staff: 'owner_only' } }).length).toBe(1);
  });
  test('manifest validation covers settings fields', () => {
    const m = (f) => ({ product: 'mart', title: 'Mart', nav: [{ key: 'd', label: 'Discounts', screen: 'settings', settings: 'discount' }], settings: { discount: { endpoint: '/settings', fields: f } } });
    expect(validateManifest(m(fields)).product).toBe('mart');
    expect(code(() => validateManifest(m([{ key: 'a', label: 'A', type: 'select' }])))).toBe('MANIFEST_INVALID');
    expect(code(() => validateManifest(m([{ key: 'a', label: 'A', type: 'weird' }])))).toBe('MANIFEST_INVALID');
    expect(code(() => validateManifest(m([{ key: 'a', type: 'text' }])))).toBe('MANIFEST_INVALID');
  });
});

describe('every shop product has the discount-rule screen (SET-03, D-30)', () => {
  for (const app of ['mart', 'wash', 'cloth', 'salon', 'dine']) {
    test(app + ': manifest is valid and the owner can reach the discount rule', () => {
      const m = JSON.parse(fs.readFileSync(new URL(`../../../apps/${app}/admin/manifest.json`, import.meta.url), 'utf8'));
      expect(validateManifest(m).product).toBe(app);
      const screens = Object.values(m.settings || {}).filter((d) => (d.fields || []).some((f) => f.key === 'discountRule.staff'));
      expect(screens.length).toBe(1);
      expect(screens[0].endpoint).toBe('/settings');
      const nav = m.nav.find((n) => n.screen === 'settings' && m.settings[n.settings] === screens[0]);
      expect(!!nav).toBe(true);
      if (nav.roles) expect(nav.roles).toEqual(['admin']);
    });
  }
});
