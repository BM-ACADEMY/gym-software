const fs = require('fs'); const path = require('path');
const dir = path.join(__dirname, '..', 'pwa');
const pngSize = (f) => { const b = fs.readFileSync(path.join(dir, f)); return b.slice(0, 8).toString('hex') === '89504e470d0a1a0a' ? [b.readUInt32BE(16), b.readUInt32BE(20)] : null; };
describe('install files', () => {
  test('manifest is valid JSON, has the three icons and every icon file exists at its stated size', () => {
    const m = JSON.parse(fs.readFileSync(path.join(dir, 'manifest.webmanifest'), 'utf8'));
    expect(m.display).toBe('standalone'); expect(m.icons.length).toBe(3); expect(m.icons.some((i) => i.purpose === 'maskable')).toBe(true);
    for (const i of m.icons) { const f = i.src.replace('/', ''); const [w, h] = pngSize(f); expect(`${w}x${h}`).toBe(i.sizes); }
  });
  test('service worker never caches API calls and has no Hire leftovers; the shell version is Wash', () => {
    const sw = fs.readFileSync(path.join(dir, 'sw.js'), 'utf8');
    expect(sw).toMatch(/wash-shell-v1/); expect(sw).toMatch(/startsWith\('\/api'\)/); expect(/hire/i.test(sw)).toBe(false);
  });
});
