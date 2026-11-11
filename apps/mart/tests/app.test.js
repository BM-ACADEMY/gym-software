const fs = require('fs'); const path = require('path');
const { createApp, missingSettings } = require('../src/app');
function fakeExpress() {
  const calls = [];
  const app = { disable() {}, use: (...a) => calls.push(['use', ...a]), get: (...a) => calls.push(['get', ...a]), calls };
  const ex = () => app; ex.json = () => 'json'; ex.Router = () => ({ use() {}, get() {}, post() {}, put() {}, patch() {}, delete() {} });
  return { ex, app };
}
describe('Mart app fails closed', () => {
  test('lists missing settings', () => {
    expect(missingSettings({}).join()).toBe('MONGODB_URI,MART_SESSION_SECRET');
    expect(missingSettings({ MONGODB_URI: 'x', MART_SESSION_SECRET: 'short' }).join()).toBe('MART_SESSION_SECRET');
    expect(missingSettings({ MONGODB_URI: 'x', MART_SESSION_SECRET: 'k'.repeat(32) }).length).toBe(0);
  });
  test('without settings every /api route answers 503 and nothing else is mounted', () => {
    const { ex, app } = fakeExpress(); createApp({ express: ex, mongoose: {}, env: {} });
    const mounts = app.calls.filter((c) => c[0] === 'use' && typeof c[1] === 'string' && c[1][0] === '/');
    expect(mounts.length).toBe(1); expect(mounts[0][1]).toBe('/api');
    let out; mounts[0][2]({}, { status: (c) => ({ json: (b) => { out = { c, b }; } }) }); expect(out.c).toBe(503);
  });
});
describe('Mart manifest', () => {
  test('every nav item points at something defined, every endpoint starts with /, no money field takes decimals', async () => {
    const m = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'admin', 'manifest.json'), 'utf8'));
    expect(m.product).toBe('mart');
    for (const n of m.nav) {
      if (n.screen === 'stats') expect(!!m.stats[n.stats]).toBe(true);
      if (n.screen === 'resource') expect(!!m.resources[n.resource]).toBe(true);
      if (n.screen === 'settings') expect(!!m.settings[n.settings]).toBe(true);
    }
    for (const s of Object.values(m.stats)) expect(s.endpoint[0]).toBe('/');
    for (const r of Object.values(m.resources)) expect(r.endpoint[0]).toBe('/');
  });
});
