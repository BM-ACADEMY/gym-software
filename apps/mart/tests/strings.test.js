const fs = require('fs'); const path = require('path');
const m = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'admin', 'manifest.json'), 'utf8'));
const s = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'admin', 'strings.json'), 'utf8'));
describe('Mart Tamil and Hindi screen names (M-06)', () => {
  test('every panel item has English, Tamil and Hindi text, none empty, and the file says it still needs native review', () => {
    expect(s._meta.status).toMatch(/needs native review/);
    for (const n of m.nav) for (const l of ['en', 'ta', 'hi']) { expect([n.key, l, typeof s[l][n.key]]).toEqual([n.key, l, 'string']); expect(s[l][n.key].trim().length > 0).toBe(true); }
    expect(s.ta.today).not.toBe(s.en.today); expect(s.hi.today).not.toBe(s.en.today);
  });
});
