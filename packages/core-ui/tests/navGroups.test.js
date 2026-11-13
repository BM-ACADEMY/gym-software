import { describe, test, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { groupNav, groupOf, GROUP_ORDER } from '../src/admin/navGroups.js';

const item = (key, extra = {}) => ({ key, label: key, ...extra });
describe('panel menu groups', () => {
  test('a short menu is left as it is', () => { expect(groupNav([item('a'), item('b')])).toBeNull(); });
  test('a long menu is grouped in heading order and loses nothing', () => {
    const nav = ['payroll', 'start', 'gst30', 'customers', 'weird', 'services', 'bills'].map((k) => item(k));
    const g = groupNav(nav, 5);
    expect(g.map((x) => x.group)).toEqual(['Daily', 'People', 'Catalogue', 'Money', 'Reports', 'Team', 'More']);
    expect(g.flatMap((x) => x.items).length).toBe(nav.length);
  });
  test('an item can name its own group; an unknown group name is ignored', () => {
    expect(groupOf(item('weird', { group: 'Grow' }))).toBe('Grow');
    expect(groupOf(item('weird', { group: 'Nonsense' }))).toBe('More');
  });
  test('every real product menu is grouped and every item lands under a known heading', () => {
    const dir = new URL('../../../apps/', import.meta.url);
    for (const p of readdirSync(dir)) {
      let m; try { m = JSON.parse(readFileSync(new URL(`${p}/admin/manifest.json`, dir), 'utf8')); } catch (e) { continue; }
      const g = groupNav(m.nav);
      if (m.nav.length >= 9) { expect(g, p).not.toBeNull(); expect(g.flatMap((x) => x.items).length, p).toBe(m.nav.length); g.forEach((x) => expect(GROUP_ORDER).toContain(x.group)); }
    }
  });
});
