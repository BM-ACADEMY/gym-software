import { describe, test, expect } from 'vitest';
import * as S from '../src/admin/schema.js';
const base = () => ({ product: 'hire', title: 'Hire', nav: [{ key: 'cands', label: 'Candidates', screen: 'resource', resource: 'candidates' }, { key: 'home', label: 'Today', screen: 'stats', stats: 'today' }],
  resources: { candidates: { endpoint: '/candidates', columns: [{ key: 'name' }, { key: 'phone', type: 'phone' }], fields: [{ key: 'name', required: true }, { key: 'status', type: 'select', options: ['a', 'b'] }] } }, stats: { today: { endpoint: '/x', cards: [] } } });
const code = (fn) => { try { fn(); } catch (e) { return e.code; } return 'none'; };
describe('manifest', () => {
  test('a good manifest passes', () => { expect(S.validateManifest(base()).product).toBe('hire'); });
  test('bad manifests are refused with a reason', () => {
    expect(code(() => S.validateManifest(null))).toBe('MANIFEST_INVALID');
    const a = base(); a.nav[0].resource = 'nope'; expect(code(() => S.validateManifest(a))).toBe('MANIFEST_INVALID');
    const b = base(); b.nav.push({ ...b.nav[0] }); expect(code(() => S.validateManifest(b))).toBe('MANIFEST_INVALID');
    const c = base(); c.resources.candidates.endpoint = 'candidates'; expect(code(() => S.validateManifest(c))).toBe('MANIFEST_INVALID');
    const d = base(); d.resources.candidates.fields[1].options = []; expect(code(() => S.validateManifest(d))).toBe('MANIFEST_INVALID');
    const e = base(); e.product = 'Bad Name'; expect(code(() => S.validateManifest(e))).toBe('MANIFEST_INVALID');
  });
  test('nav is filtered by role', () => {
    const m = base(); m.nav[1].roles = ['admin'];
    expect(S.visibleNav(m, 'subadmin').map((n) => n.key)).toEqual(['cands']); expect(S.visibleNav(m, 'admin')).toHaveLength(2);
  });
  test('nav can be built from API data', () => {
    const m = { nav: [{ key: 'home', label: 'Overview', screen: 'stats' }, { key: 'prod', label: 'x', screen: 'stats', from: { source: 'overview', path: 'products', idKey: 'product', labelKey: 'product' } }] };
    const out = S.expandNav(m, { overview: { products: [{ product: 'gym' }, { product: 'hire' }] } });
    expect(out.map((n) => n.key)).toEqual(['home', 'prod-gym', 'prod-hire']); expect(out[2].params).toEqual({ product: 'hire' });
  });
});
describe('cells and records', () => {
  test('format cells', () => {
    expect(S.formatCell('money', 59000)).toBe('Rs 59,000'); expect(S.formatCell('tags', ['a', 'b'])).toBe('a, b'); expect(S.formatCell('bool', false)).toBe('No');
    expect(S.formatCell('phone', '+919876543210')).not.toMatch(/9876543210/); expect(S.formatCell('text', null)).toBe('-'); expect(S.formatCell('date', 'garbage')).toBe('-');
  });
  test('record validation mirrors the server', () => {
    const f = [{ key: 'name', label: 'Name', required: true }, { key: 'fee', type: 'money', min: 0 }, { key: 'email', type: 'email' }, { key: 'phone', type: 'phone' }, { key: 'skills', type: 'tags' }, { key: 'st', type: 'select', options: ['a'] }];
    const bad = S.validateRecord(f, { fee: 10.5, email: 'x', phone: '123', st: 'z' });
    expect(bad.ok).toBe(false); expect(Object.keys(bad.errors).sort()).toEqual(['email', 'fee', 'name', 'phone', 'st']);
    const good = S.validateRecord(f, { name: ' Ravi ', fee: '500', email: 'r@x.com', phone: '98765 43210', skills: 'java, sql', st: 'a' });
    expect(good.ok).toBe(true); expect(good.values.name).toBe('Ravi'); expect(good.values.fee).toBe(500); expect(good.values.skills).toEqual(['java', 'sql']);
  });
  test('getPath reads nested values safely', () => { expect(S.getPath({ a: { b: 3 } }, 'a.b')).toBe(3); expect(S.getPath({}, 'a.b')).toBe(undefined); });
});
