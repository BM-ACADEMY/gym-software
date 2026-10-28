const path = require('path');
const { shape } = require('../controllers/rootAdmin/products');
const raw = require('../data/productStatus.json');

describe('product launch tracker data', () => {
  test('every product has the fields the screen needs', () => {
    expect(raw.products.length).toBe(7);
    for (const p of raw.products) {
      for (const k of ['key', 'name', 'address', 'targetDate', 'stage', 'confidence', 'done', 'next', 'blockers', 'suggestions', 'updates', 'launchChecklist']) expect(p[k]).toBeDefined();
      expect(/^\d{4}-\d{2}-\d{2}$/.test(p.targetDate)).toBe(true);
      p.updates.forEach((u) => { expect(typeof u.date).toBe('string'); expect(typeof u.text).toBe('string'); });
    }
  });
  test('no secret-looking text in the file', () => {
    expect(/password\s*[:=]|api[_-]?key\s*[:=]|sk-[A-Za-z0-9]{10,}/i.test(JSON.stringify(raw))).toBe(false);
  });
  test('shape counts checklist and days left; bad confidence becomes low', () => {
    const out = shape({ updatedAt: '2026-10-28', products: [{ key: 'a', targetDate: '2026-11-10', confidence: 'sure', launchChecklist: [{ item: 'x', done: true }, { item: 'y', done: false }] }] }, new Date('2026-10-28T20:00:00Z'));
    expect(out.products[0].checklistDone).toBe(1); expect(out.products[0].checklistTotal).toBe(2);
    expect(out.products[0].daysToTarget).toBe(13); expect(out.products[0].confidence).toBe('low');
  });
});
