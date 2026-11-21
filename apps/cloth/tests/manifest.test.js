const fs = require('fs'); const path = require('path');
describe('Cloth owner panel manifest', () => {
  test('passes the shared panel validator and every stats screen a nav item names exists', async () => {
    const m = JSON.parse(fs.readFileSync(path.join(__dirname, '../admin/manifest.json'), 'utf8'));
    const { validateManifest } = await import(path.join(__dirname, '../../../packages/core-ui/src/admin/schema.js'));
    validateManifest(m);
    for (const n of m.nav) { if (n.screen === 'stats') expect(!!m.stats[n.stats]).toBe(true); if (n.screen === 'settings') expect(!!m.settings[n.settings]).toBe(true); if (n.screen === 'resource') expect(!!m.resources[n.resource]).toBe(true); }
    for (const k of ['sales_item', 'sales_staff', 'sales_hour', 'pnl', 'gst', 'expenses', 'leaks', 'audit', 'payroll']) expect(m.nav.some((n) => n.key === k)).toBe(true);
    const adminOnly = m.nav.filter((n) => ['pnl', 'gst', 'leaks', 'audit', 'payroll'].includes(n.key)); expect(adminOnly.every((n) => (n.roles || []).includes('admin') && !(n.roles || []).includes('subadmin'))).toBe(true);
  });
});
