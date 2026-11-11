const S = require('../src/session'); const { hashPassword, verifyPassword } = require('../src/authRoutes');
const K = 'k'.repeat(40);
describe('Cloth session', () => {
  test('sign, verify, tamper, expiry, wrong key', () => {
    const t = S.sign({ uid: 'u', tid: 't' }, K, 1000); expect(S.verify(t, K, 2000).tid).toBe('t');
    expect(S.verify(t.slice(0, -2) + 'xx', K, 2000)).toBeNull(); expect(S.verify(t, 'z'.repeat(40), 2000)).toBeNull(); expect(S.verify(t, K, 1000 + S.TTL_MS + 1)).toBeNull(); expect(S.verify('garbage', K)).toBeNull();
    expect(() => S.sign({}, 'short')).toThrow();
  });
  test('cookie is HttpOnly, Secure, SameSite=Strict and round-trips', () => {
    const h = S.cookieHeader('a.b'); expect(h).toMatch(/HttpOnly; Secure; SameSite=Strict/); expect(S.readCookie('x=1; afra_cloth=a.b; y=2')).toBe('a.b');
  });
  test('password hash verifies and is salted', async () => {
    const a = await hashPassword('correct horse'); const b = await hashPassword('correct horse');
    expect(a === b).toBe(false); expect(await verifyPassword('correct horse', a)).toBe(true); expect(await verifyPassword('wrong', a)).toBe(false);
  });
});
