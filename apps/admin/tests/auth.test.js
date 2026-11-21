const C = require('../src/auth/crypto');
const { createFlow, MAX_FAILS, TICKET_MS, SESSION_MS } = require('../src/auth/flow');

describe('crypto', () => {
  test('password hashing: right password works, wrong fails, short refused', () => {
    const h = C.hashPassword('correct horse battery'); expect(C.verifyPassword('correct horse battery', h)).toBe(true); expect(C.verifyPassword('wrong', h)).toBe(false);
    expect(C.verifyPassword('x', 'garbage')).toBe(false); expect(() => C.hashPassword('short')).toThrow();
    expect(C.hashPassword('correct horse battery')).not.toBe(h);
  });
  test('TOTP matches the RFC 6238 test vector', () => {
    const secret = Buffer.from('12345678901234567890');
    expect(C.hotp(secret, Math.floor(59 / 30), 8)).toBe('94287082'); expect(C.hotp(secret, Math.floor(1111111109 / 30), 8)).toBe('07081804');
    const b32 = C.base32Encode(secret); expect(C.base32Decode(b32).toString()).toBe('12345678901234567890');
    expect(C.verifyTotp(b32, '287082', 59000)).toBe(1); expect(C.verifyTotp(b32, '287082', 59000 + 30000)).toBe(1); // one step of drift allowed
    expect(C.verifyTotp(b32, '287082', 59000 + 120000)).toBeNull(); expect(C.verifyTotp(b32, 'abcdef', 59000)).toBeNull();
  });
  test('signed tokens: tamper, wrong key and expiry are refused', () => {
    const t = C.sign({ a: 1, exp: 2000 }, 'k'.repeat(32));
    expect(C.verifySigned(t, 'k'.repeat(32), 1000).a).toBe(1); expect(C.verifySigned(t, 'j'.repeat(32), 1000)).toBeNull(); expect(C.verifySigned(t, 'k'.repeat(32), 3000)).toBeNull();
    const [b, m] = t.split('.'); const forged = Buffer.from(JSON.stringify({ a: 2, exp: 9e12 })).toString('base64url') + '.' + m;
    expect(C.verifySigned(forged, 'k'.repeat(32), 1000)).toBeNull(); expect(C.verifySigned('junk', 'k'.repeat(32))).toBeNull();
  });
  test('secret encryption round trip and tamper', () => {
    const key = require('crypto').randomBytes(32).toString('base64'); const e = C.encrypt('SECRET', key);
    expect(C.decrypt(e, key)).toBe('SECRET'); expect(e).not.toMatch(/SECRET/); expect(() => C.decrypt(e.slice(0, -2) + 'AA', key)).toThrow();
  });
});

function setup(nowRef = { t: 1000000000000 }) {
  const mfaKey = require('crypto').randomBytes(32).toString('base64'); const secret = C.newTotpSecret();
  const user = { email: 'owner@afraventures.in', role: 'root_admin', passwordHash: C.hashPassword('long enough password'), totpSecretEnc: C.encrypt(secret, mfaKey), recoveryHashes: [C.sha256('abcdef1234')], lastTotpStep: 0 };
  const events = [];
  const flow = createFlow({ users: { find: async (e) => (e === user.email ? user : null), save: async () => {} }, secrets: { session: 's'.repeat(40), mfaKey }, audit: (e) => events.push(e), now: () => nowRef.t });
  const code = () => C.hotp(C.base32Decode(secret), C.stepOf(nowRef.t));
  return { flow, user, events, nowRef, code };
}
describe('sign-in flow', () => {
  test('password then code gives a session; session is readable', async () => {
    const { flow, code, events } = setup();
    const a = await flow.login({ email: ' Owner@AfraVentures.in ', password: 'long enough password', ip: '1.1.1.1' }); expect(a.ok).toBe(true);
    const b = await flow.verifyCode({ ticket: a.ticket, code: code(), ip: '1.1.1.1' }); expect(b.ok).toBe(true);
    expect(flow.readSession(b.session)).toEqual({ email: 'owner@afraventures.in', role: 'root_admin' });
    expect(events.map((e) => e.type)).toEqual(['login_ok']); expect(JSON.stringify(events)).not.toMatch(/long enough password/);
  });
  test('wrong password, unknown email and wrong code all give the same answer', async () => {
    const { flow } = setup();
    const x = await flow.login({ email: 'owner@afraventures.in', password: 'nope nope nope nope' }); const y = await flow.login({ email: 'who@else.com', password: 'nope nope nope nope' });
    expect(x.message).toBe(y.message); expect(x.status).toBe(401);
    const a = await flow.login({ email: 'owner@afraventures.in', password: 'long enough password' });
    expect((await flow.verifyCode({ ticket: a.ticket, code: '000000' })).status).toBe(401);
  });
  test('a code works only once (replay refused)', async () => {
    const { flow, code, user } = setup();
    const a = await flow.login({ email: user.email, password: 'long enough password' }); const c = code();
    expect((await flow.verifyCode({ ticket: a.ticket, code: c })).ok).toBe(true);
    const a2 = await flow.login({ email: user.email, password: 'long enough password' });
    expect((await flow.verifyCode({ ticket: a2.ticket, code: c })).ok).toBe(false);
  });
  test('recovery code works once', async () => {
    const { flow, user } = setup();
    const a = await flow.login({ email: user.email, password: 'long enough password' });
    expect((await flow.verifyCode({ ticket: a.ticket, code: 'ABCDEF1234' })).ok).toBe(true);
    expect((await flow.verifyCode({ ticket: a.ticket, code: 'abcdef1234' })).ok).toBe(false);
  });
  test('five wrong passwords lock that email and address for 15 minutes', async () => {
    const { flow, user, nowRef } = setup();
    for (let i = 0; i < MAX_FAILS; i++) await flow.login({ email: user.email, password: 'wrong wrong wrong', ip: '2.2.2.2' });
    expect((await flow.login({ email: user.email, password: 'long enough password', ip: '2.2.2.2' })).status).toBe(429);
    nowRef.t += 16 * 60 * 1000;
    expect((await flow.login({ email: user.email, password: 'long enough password', ip: '2.2.2.2' })).ok).toBe(true);
  });
  test('ticket and session expire; a ticket cannot be used as a session and the reverse', async () => {
    const { flow, user, nowRef, code } = setup();
    const a = await flow.login({ email: user.email, password: 'long enough password' });
    expect(flow.readSession(a.ticket)).toBeNull();
    nowRef.t += TICKET_MS + 1000; expect((await flow.verifyCode({ ticket: a.ticket, code: code() })).status).toBe(401);
    const b = await flow.login({ email: user.email, password: 'long enough password' }); const s = await flow.verifyCode({ ticket: b.ticket, code: code() });
    expect((await flow.verifyCode({ ticket: s.session, code: code() })).ok).toBe(false);
    nowRef.t += SESSION_MS + 1000; expect(flow.readSession(s.session)).toBeNull();
  });
  test('a disabled user cannot sign in', async () => {
    const { flow, user } = setup(); user.disabled = true;
    expect((await flow.login({ email: user.email, password: 'long enough password' })).status).toBe(401);
  });
});

describe('server stays closed without settings', () => {
  test('build() returns null when anything is missing', () => {
    const auth = require('../src/auth');
    expect(auth.build({})).toBeNull(); expect(auth.build({ ADMIN_SESSION_SECRET: 'short', ADMIN_MFA_KEY: 'x', ADMIN_USERS_FILE: '/x', ADMIN_AUDIT_FILE: '/y' })).toBeNull();
    expect(auth.build({ ADMIN_SESSION_SECRET: 's'.repeat(40), ADMIN_MFA_KEY: require('crypto').randomBytes(32).toString('base64'), ADMIN_USERS_FILE: '/nonexistent/users.json', ADMIN_AUDIT_FILE: '/y' })).toBeNull();
  });
});
