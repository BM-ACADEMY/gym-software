const { signUp, signIn, MAX_FAILS } = require('../src/signup');
const { makeBilling } = require('../../../packages/core-billing/src');
const billing = makeBilling({ plans: { a: { key: 'a', monthly: 1, yearly: 10 } }, gstRate: 18, graceDays: 3, trialDays: 14, trialPlanKey: 'a', ranks: { a: 0 } });
function mk() { const users = []; const tenants = []; return { users, tenants,
  findUserByEmail: async (e) => users.find((u) => u.email === e) || null,
  createTenant: async (t) => { const x = { id: 't' + tenants.length, ...t }; tenants.push(x); return x; },
  createUser: async (u) => { const x = { id: 'u' + users.length, ...u }; users.push(x); return x; },
  updateUser: async (id, p) => Object.assign(users.find((u) => u.id === id), p) }; }
const hash = async (p) => 'h:' + p; const verify = async (p, h) => h === 'h:' + p;
const ok = { businessName: 'Sri Staffing', ownerName: 'Ravi', email: ' Ravi@Example.com ', state: 'Tamil Nadu', password: 'longenough1', acceptTerms: true };
const now = new Date('2026-11-01T00:00:00Z');
describe('Wash sign-up', () => {
  test('creates agency with 14-day trial and normalised email', async () => {
    const s = mk(); const r = await signUp(ok, { store: s, hash, billing, now, termsVersion: 'v1' });
    expect(r.trialEndsAt.getTime()).toBe(now.getTime() + 14 * 86400000); expect(s.users[0].email).toBe('ravi@example.com'); expect(s.users[0].passwordHash).not.toBe('longenough1'); expect(s.tenants[0].currency).toBe('INR');
  });
  test('refuses bad input and duplicates', async () => {
    const s = mk(); const d = { store: s, hash, billing, now };
    for (const [k, v, c] of [['email', 'nope', 'SIGNUP_EMAIL'], ['password', 'short', 'SIGNUP_PASSWORD'], ['acceptTerms', false, 'SIGNUP_TERMS'], ['state', '', 'SIGNUP_STATE'], ['businessName', '', 'SIGNUP_NAME']])
      await expect(signUp({ ...ok, [k]: v }, d)).rejects.toMatchObject({ code: c });
    await signUp(ok, d); await expect(signUp(ok, d)).rejects.toMatchObject({ code: 'SIGNUP_EXISTS' });
  });
});
describe('Wash sign-in', () => {
  test('good login, same message for unknown email and wrong password, lock after 5 fails', async () => {
    const s = mk(); await signUp(ok, { store: s, hash, billing, now }); const d = { store: s, verify, now };
    expect((await signIn({ email: 'RAVI@example.com', password: 'longenough1' }, d)).role).toBe('admin');
    await expect(signIn({ email: 'x@y.com', password: 'a' }, d)).rejects.toMatchObject({ code: 'LOGIN_BAD' });
    for (let i = 0; i < MAX_FAILS; i++) await expect(signIn({ email: 'ravi@example.com', password: 'wrong' }, d)).rejects.toMatchObject({ code: 'LOGIN_BAD' });
    await expect(signIn({ email: 'ravi@example.com', password: 'longenough1' }, d)).rejects.toMatchObject({ code: 'LOGIN_LOCKED' });
    const later = { ...d, now: new Date(now.getTime() + 16 * 60000) };
    expect((await signIn({ email: 'ravi@example.com', password: 'longenough1' }, later)).userId).toBe('u0');
  });
});
describe('Wash sign-up contact permission', () => {
  test('call permission needs a phone; saved only when exactly true', async () => {
    const s = mk(); const d = { store: s, hash, billing, now };
    await expect(signUp({ ...ok, salesContactOk: true }, d)).rejects.toMatchObject({ code: 'SIGNUP_PHONE' });
    await expect(signUp({ ...ok, phone: '12' }, d)).rejects.toMatchObject({ code: 'SIGNUP_PHONE' });
    await signUp({ ...ok, phone: '98765 43210', salesContactOk: true }, d); expect(s.users[0].salesContactOk).toBe(true); expect(s.users[0].phone).toBe('9876543210');
    const s2 = mk(); await signUp({ ...ok, salesContactOk: 'yes' }, { store: s2, hash, billing, now }); expect(s2.users[0].salesContactOk).toBe(false);
  });
});
