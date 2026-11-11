import { describe, test, expect } from 'vitest';
import fs from 'node:fs';
import { validateManifest } from '../src/admin/schema.js';

const read = (p) => fs.readFileSync(new URL(p, import.meta.url), 'utf8');
const hire = JSON.parse(read('../../../apps/hire/admin/manifest.json'));
const adminApp = JSON.parse(read('../../../apps/admin/manifest.json'));
const hireRoutes = read('../../../apps/hire/src/routes.js');
const adminRoutes = read('../../../apps/admin/src/routes.js');

// Every endpoint the panel calls must exist as a real route, so a renamed route cannot silently break a screen.
const hasRoute = (src, method, path) => src.includes(`router.${method}('${path}'`);
const pathsOf = (m) => {
  const out = [];
  for (const r of Object.values(m.resources || {})) {
    out.push(['get', r.endpoint]);
    if (r.fields && !r.readOnly) { out.push(['post', r.endpoint]); out.push(['patch', r.endpoint + '/:id']); }
    for (const a of r.actions || []) out.push([(a.method || 'POST').toLowerCase().replace('delete', 'delete'), a.path]);
  }
  for (const s of Object.values(m.stats || {})) out.push(['get', s.endpoint]);
  for (const s of Object.values(m.settings || {})) { out.push(['get', s.endpoint]); out.push(['put', s.endpoint]); }
  return out;
};

describe('panel manifests', () => {
  test('both manifests are valid', () => { expect(validateManifest(hire).product).toBe('hire'); expect(validateManifest(adminApp).product).toBe('admin'); });
  test('every Hire panel call has a real Hire route', () => {
    const missing = pathsOf(hire).filter(([m, p]) => !hasRoute(hireRoutes, m, p)).map(([m, p]) => `${m} ${p}`);
    expect(missing).toEqual([]);
  });
  test('Super Admin calls the overview route', () => {
    const calls = [...new Set([adminApp.navData.overview, ...Object.values(adminApp.stats).map((s) => s.endpoint)])];
    expect(calls).toEqual(['/overview']); expect(hasRoute(adminRoutes, 'get', '/overview')).toBe(true);
  });
  test('no screen shows a full phone number or hard-codes a product list', () => {
    // The Ideas board has its own product-area choices (it files ideas by product); every other screen must come from the product list API.
    const { ideas, ...otherResources } = adminApp.resources || {};
    expect(JSON.stringify({ ...adminApp, resources: otherResources })).not.toMatch(/"gym"|"hire"|"mart"/);
    const phoneCols = JSON.stringify(hire).match(/"key":"phone"[^}]*/g) || [];
    phoneCols.forEach((c) => expect(c).toMatch(/phone/));
  });
});
