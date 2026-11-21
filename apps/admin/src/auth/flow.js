'use strict';
// The sign-in steps as plain functions (no Express), so every rule is tested without a server.
// deps: { users: { find(email), save(user) }, secrets: { session, mfaKey }, audit(event), now() }
const C = require('./crypto');
const TICKET_MS = 5 * 60 * 1000, SESSION_MS = 8 * 3600 * 1000, MAX_FAILS = 5, LOCK_MS = 15 * 60 * 1000;

function makeLimiter(now) {
  const m = new Map();
  return {
    blocked: (k) => { const e = m.get(k); return !!(e && e.until && e.until > now()); },
    fail: (k) => { const e = m.get(k) || { n: 0 }; e.n += 1; if (e.n >= MAX_FAILS) { e.until = now() + LOCK_MS; e.n = 0; } m.set(k, e); },
    ok: (k) => m.delete(k),
  };
}
const GENERIC = { ok: false, status: 401, message: 'Email, password or code is not right.' };
const LOCKED = { ok: false, status: 429, message: 'Too many tries. Wait 15 minutes.' };

function createFlow(deps) {
  const now = deps.now || Date.now; const lim = makeLimiter(now);
  const audit = (e) => { try { deps.audit({ at: new Date(now()).toISOString(), ...e }); } catch (_) { /* logging must never break sign-in */ } };

  async function login({ email, password, ip }) {
    const em = String(email || '').trim().toLowerCase().slice(0, 200); const key = `${em}|${ip || ''}`;
    if (lim.blocked(key) || lim.blocked(`ip|${ip || ''}`)) { audit({ type: 'login_blocked', email: em, ip }); return LOCKED; }
    const user = await deps.users.find(em);
    if (!user || user.disabled) { C.burnTime(password); lim.fail(key); lim.fail(`ip|${ip || ''}`); audit({ type: 'login_fail', email: em, ip }); return GENERIC; }
    if (!C.verifyPassword(password, user.passwordHash)) { lim.fail(key); lim.fail(`ip|${ip || ''}`); audit({ type: 'login_fail', email: em, ip }); return GENERIC; }
    // password right: now ask for the one-time code. The ticket proves step one only, and lasts 5 minutes.
    return { ok: true, ticket: C.sign({ k: 'ticket', e: em, exp: now() + TICKET_MS }, deps.secrets.session) };
  }

  async function verifyCode({ ticket, code, ip }) {
    const t = C.verifySigned(ticket, deps.secrets.session, now());
    if (!t || t.k !== 'ticket') return GENERIC;
    const key = `${t.e}|${ip || ''}`;
    if (lim.blocked(key)) return LOCKED;
    const user = await deps.users.find(t.e);
    if (!user || user.disabled) return GENERIC;
    let good = false;
    const secret = C.decrypt(user.totpSecretEnc, deps.secrets.mfaKey);
    const step = C.verifyTotp(secret, code, now());
    if (step !== null && step > (user.lastTotpStep || 0)) { // a code can be used once
      good = true; user.lastTotpStep = step; await deps.users.save(user);
    } else { // recovery code: one use each
      const h = C.sha256(String(code || '').trim().toLowerCase());
      const i = (user.recoveryHashes || []).indexOf(h);
      if (i >= 0) { user.recoveryHashes.splice(i, 1); await deps.users.save(user); good = true; audit({ type: 'recovery_code_used', email: t.e, ip }); }
    }
    if (!good) { lim.fail(key); lim.fail(`ip|${ip || ''}`); audit({ type: 'code_fail', email: t.e, ip }); return GENERIC; }
    lim.ok(key);
    audit({ type: 'login_ok', email: t.e, ip });
    return { ok: true, session: C.sign({ k: 'session', e: t.e, role: user.role || 'root_admin', exp: now() + SESSION_MS }, deps.secrets.session), maxAgeMs: SESSION_MS };
  }

  function readSession(token) { const s = C.verifySigned(token, deps.secrets.session, now()); return s && s.k === 'session' ? { email: s.e, role: s.role } : null; }
  return { login, verifyCode, readSession, audit };
}
module.exports = { createFlow, TICKET_MS, SESSION_MS, MAX_FAILS, LOCK_MS };
