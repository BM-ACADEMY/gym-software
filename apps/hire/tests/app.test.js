const { createApp, missingSettings } = require('../src/app');
function fakeExpress() {
  const calls = [];
  const app = { disable() {}, use: (...a) => calls.push(['use', ...a]), get: (...a) => calls.push(['get', ...a]), calls };
  const ex = () => app; ex.json = () => 'json'; ex.Router = () => ({ use() {}, get() {}, post() {}, put() {}, patch() {}, delete() {} });
  return { ex, app };
}
describe('Hire app fails closed', () => {
  test('lists missing settings', () => {
    expect(missingSettings({}).join()).toBe('MONGODB_URI,HIRE_SESSION_SECRET');
    expect(missingSettings({ MONGODB_URI: 'x', HIRE_SESSION_SECRET: 'short' }).join()).toBe('HIRE_SESSION_SECRET');
    expect(missingSettings({ MONGODB_URI: 'x', HIRE_SESSION_SECRET: 'k'.repeat(32) }).length).toBe(0);
  });
  test('without settings every /api route answers 503 and nothing else is mounted', () => {
    const { ex, app } = fakeExpress(); createApp({ express: ex, mongoose: {}, env: {} });
    const mounts = app.calls.filter((c) => c[0] === 'use' && typeof c[1] === 'string' && c[1][0] === '/');
    expect(mounts.length).toBe(1); expect(mounts[0][1]).toBe('/api');
    let out; mounts[0][2]({}, { status: (c) => ({ json: (b) => { out = { c, b }; } }) }); expect(out.c).toBe(503);
  });
});
