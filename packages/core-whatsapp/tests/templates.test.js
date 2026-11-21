const fs = require('fs'); const path = require('path');
const { TEMPLATES, render, orderedParams } = require('../src/afraTemplates');
const { doc } = require('../../../scripts/gen-template-doc');
describe('Afra B2B WhatsApp templates', () => {
  test('every template is consistent: placeholders match params and samples, names are lowercase afra_', () => {
    for (const [n, t] of Object.entries(TEMPLATES)) {
      expect(/^afra_[a-z_]+$/.test(n)).toBe(true);
      const nums = [...t.body.matchAll(/{{(\d+)}}/g)].map((m) => Number(m[1]));
      expect(nums.join()).toBe(t.params.map((_, i) => i + 1).join()); // each used once, in order
      expect(t.sample.length).toBe(t.params.length);
      expect(t.body.length < 500).toBe(true); expect(/^\s|\s$/.test(t.body)).toBe(false); expect(/{{\d+}}$/.test(t.body) || /^{{/.test(t.body)).toBe(false); // Meta rejects a body that starts or ends on a variable
      expect(['UTILITY', 'MARKETING']).toContain(t.category);
    }
  });
  test('render and ordered params', () => {
    expect(render('afra_trial_ending', { name: 'Ravi', product: 'Fit', days: 3, end_date: '12 Nov', phone: '98' })).toBe('Hi Ravi, your Fit free trial ends in 3 day(s), on 12 Nov. To keep your data and continue, choose a plan in the app. Help: 98.');
    expect(orderedParams('afra_callback', { name: 'A\nB', product: 'Fit', day: 'Fri' }).join('|')).toBe('A B|Fit|Fri|-');
    expect(() => render('nope', {})).toThrow();
  });
  test('only the win-back is marketing; no template promises a discount or a guarantee', () => {
    expect(Object.entries(TEMPLATES).filter(([, t]) => t.category === 'MARKETING').map(([n]) => n).join()).toBe('afra_winback');
    for (const t of Object.values(TEMPLATES)) expect(/discount|offer|guarantee|free gift|% off/i.test(t.body.replace('free trial', ''))).toBe(false);
  });
  test('the generated document is up to date', () => {
    expect(fs.readFileSync(path.join(__dirname, '../../../docs/WHATSAPP_TEMPLATES_AFRA.md'), 'utf8')).toBe(doc());
  });
});
