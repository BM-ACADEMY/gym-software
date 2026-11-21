import { describe, it, expect } from 'vitest';
import { translate } from './index';
import ta from './ta';
import hi from './hi';

describe('i18n', () => {
  it('falls back to English text when missing', () => {
    expect(translate('Some new text', null, 'ta')).toBe('Some new text');
  });
  it('translates and fills variables', () => {
    expect(translate('Members', null, 'hi')).toBe('सदस्य');
    expect(translate('Your free trial ends in {n} days. Choose a plan to keep everything running.', { n: 3 }, 'ta')).toContain('3');
  });
  it('every Tamil key exists in Hindi and the reverse', () => {
    expect(Object.keys(ta).sort()).toEqual(Object.keys(hi).sort());
  });
  it('keeps {n} placeholders in both languages', () => {
    for (const d of [ta, hi]) for (const k of Object.keys(d)) {
      expect(k.includes('{n}')).toBe(d[k].includes('{n}'));
    }
  });
});
