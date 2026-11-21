import { describe, test, expect } from 'vitest';
import fs from 'node:fs';
import * as S from '../src/admin/schema.js';
const read = (p) => fs.readFileSync(new URL(p, import.meta.url), 'utf8');
const code = (fn) => { try { fn(); } catch (e) { return e.code; } return 'none'; };
const base = () => ({ product: 'mart', title: 'Mart', nav: [{ key: 'team', label: 'Team', screen: 'resource', resource: 'team' }, { key: 'gst', label: 'GST', screen: 'stats', stats: 'gst' }],
  resources: { team: { endpoint: '/team', columns: [{ key: 'name' }], fields: [{ key: 'name', required: true }, { key: 'password', type: 'password', min: 8, required: true }] } },
  stats: { gst: { endpoint: '/reports/gst-summary', downloads: [{ label: 'File for your CA', path: '/reports/ca-export', filename: 'mart-ca.csv' }] } } });
describe('password field', () => {
  const f = [{ key: 'password', label: 'Password', type: 'password', min: 8, required: true }];
  test('needs the minimum length, is never trimmed, and is limited to 100 characters', () => {
    expect(S.validateRecord(f, { password: 'short' }).errors.password).toBe('At least 8 characters');
    expect(S.validateRecord(f, {}).errors.password).toBe('Password is needed');
    const ok = S.validateRecord(f, { password: '  spaced pass  ' }); expect(ok.ok).toBe(true); expect(ok.values.password).toBe('  spaced pass  ');
    expect(S.validateRecord(f, { password: 'x'.repeat(101) }).errors.password).toBe('At most 100 characters');
  });
  test('manifest accepts a password field in a form but never in a list', () => {
    expect(S.validateManifest(base()).product).toBe('mart');
    const m = base(); m.resources.team.columns.push({ key: 'password', type: 'password' }); expect(code(() => S.validateManifest(m))).toBe('MANIFEST_INVALID');
    const n = base(); n.resources.team.fields[1].min = 0; expect(code(() => S.validateManifest(n))).toBe('MANIFEST_INVALID');
  });
});
describe('download buttons', () => {
  test('manifest checks every download: label, path starting with a slash, no .., safe file name', () => {
    const ok = base(); expect(S.validateManifest(ok).stats.gst.downloads.length).toBe(1);
    const a = base(); a.stats.gst.downloads[0].path = 'reports/x'; expect(code(() => S.validateManifest(a))).toBe('MANIFEST_INVALID');
    const b = base(); b.stats.gst.downloads[0].path = '/reports/../secret'; expect(code(() => S.validateManifest(b))).toBe('MANIFEST_INVALID');
    const c = base(); c.stats.gst.downloads[0].label = ''; expect(code(() => S.validateManifest(c))).toBe('MANIFEST_INVALID');
    const d = base(); d.stats.gst.downloads[0].filename = '../x.csv'; expect(code(() => S.validateManifest(d))).toBe('MANIFEST_INVALID');
    const e = base(); e.stats.gst.downloads = 'nope'; expect(code(() => S.validateManifest(e))).toBe('MANIFEST_INVALID');
  });
  test('save-as name comes from the server header when it is clean, else from the manifest, never with a path', () => {
    expect(S.downloadName('attachment; filename="mart-2026-11-01-to-2026-11-30.csv"', 'x.csv')).toBe('mart-2026-11-01-to-2026-11-30.csv');
    expect(S.downloadName('attachment; filename="../../etc/passwd"', 'x.csv')).toBe('passwd');
    expect(S.downloadName('', 'mart-ca.csv')).toBe('mart-ca.csv');
    expect(S.downloadName(undefined, undefined)).toBe('download');
    expect(S.downloadName('attachment; filename="a b<c>.csv"', '')).toBe('a_b_c_.csv');
  });
});
describe('dated exports', () => {
  test('rangeDays gives the last N days up to today in Indian time', () => {
    const at = new Date('2026-11-11T20:00:00Z'); // already 12 Nov 01:30 in India
    expect(S.rangeQuery(30, at)).toEqual({ from: '2026-10-14', to: '2026-11-12' });
    expect(S.rangeQuery(1, at)).toEqual({ from: '2026-11-12', to: '2026-11-12' });
    expect(S.rangeQuery('x', at).to).toBe('2026-11-12');
  });
  test('manifest refuses a bad rangeDays', () => {
    const m = base(); m.stats.gst.downloads[0].rangeDays = 30; expect(S.validateManifest(m).product).toBe('mart');
    const a = base(); a.stats.gst.downloads[0].rangeDays = 0; expect(code(() => S.validateManifest(a))).toBe('MANIFEST_INVALID');
    const b = base(); b.stats.gst.downloads[0].rangeDays = 400; expect(code(() => S.validateManifest(b))).toBe('MANIFEST_INVALID');
  });
});
describe('Tamil and Hindi strings', () => {
  const strings = { _meta: { status: 'needs native review (M-06)' }, en: { team: 'Team logins' }, ta: { team: 'குழு உள்நுழைவுகள்' }, hi: { team: 'टीम लॉगिन', gst: '' } };
  test('menu names change, missing or empty ones stay English, input is not changed', () => {
    const m = base(); const ta = S.translateManifest(m, strings, 'ta');
    expect(ta.nav[0].label).toBe('குழு உள்நுழைவுகள்'); expect(ta.nav[1].label).toBe('GST'); expect(m.nav[0].label).toBe('Team');
    const hi = S.translateManifest(m, strings, 'hi'); expect(hi.nav[1].label).toBe('GST');
    expect(S.translateManifest(m, strings, 'en')).toBe(m); expect(S.translateManifest(m, null, 'ta')).toBe(m); expect(S.translateManifest(m, strings, 'fr')).toBe(m);
  });
  test('panel words fall back to English; the review notice shows for other languages only', () => {
    expect(S.uiText('ta', 'save')).toBe('சேமி'); expect(S.uiText('hi', 'cancel')).toBe('रद्द करें');
    expect(S.uiText('fr', 'save')).toBe('Save'); expect(S.uiText('ta', 'nope')).toBe('nope');
    expect(S.needsReview(strings, 'ta')).toBe(true); expect(S.needsReview(strings, 'en')).toBe(false); expect(S.needsReview(null, 'ta')).toBe(false);
  });
  test('every language has every panel word', () => {
    for (const l of ['ta', 'hi']) for (const k of Object.keys(S.UI_WORDS.en)) expect(typeof S.UI_WORDS[l][k]).toBe('string');
  });
});

describe('product wiring (CLIENT-06)', () => {
  const man = (a) => JSON.parse(read(`../../../apps/${a}/admin/manifest.json`));
  const downloadsOf = (m) => [...Object.values(m.stats || {}), ...Object.values(m.resources || {}), ...Object.values(m.settings || {})].flatMap((d) => d.downloads || []);
  test('Mart: the owner can add a login with a password, and the CA file download is on the GST screen', () => {
    const m = man('mart'); const t = m.resources.team;
    expect(S.validateManifest(m).product).toBe('mart');
    expect(t.canAdd).toBe(true);
    expect(t.fields.map((f) => f.key)).toEqual(['name', 'email', 'role', 'password']);
    expect(t.fields.find((f) => f.key === 'password').type).toBe('password');
    expect(t.fields.find((f) => f.key === 'role').options.map((o) => o.value)).toEqual(['subadmin', 'cashier', 'stockkeeper']);
    expect(m.nav.find((n) => n.key === 'team').roles).toEqual(['admin']);
    expect(m.stats.gst.downloads[0].path).toBe('/reports/ca-export');
  });
  test('every download in every product points at a route that product really has', () => {
    const routesOf = (a) => fs.readdirSync(new URL(`../../../apps/${a}/src/`, import.meta.url)).filter((f) => /^routes.*\.js$/.test(f)).map((f) => read(`../../../apps/${a}/src/${f}`)).join('\n');
    for (const a of ['mart', 'cloth', 'wash', 'salon', 'dine']) {
      const src = routesOf(a); const list = downloadsOf(man(a));
      expect(list.length > 0).toBe(true);
      for (const d of list) expect(src.includes(`'${d.path}'`)).toBe(true);
    }
  });
});
