'use strict';
// POST /signup, /login, /logout and GET /me for Dine. Mount before the protected router:
//   app.use('/api/dine/auth', createAuthRouter({ express, mongoose, billing, secret: process.env.DINE_SESSION_SECRET }));
// Writes need the header x-requested-with: afra-dine (blocks cross-site form posts).
const crypto = require('crypto');
const makeModels = require('./models');
const { signUp, signIn } = require('./signup');
const S = require('./session');
const { runWithTenant, runUnscoped } = require('../../../packages/core-server/src');

const hashPassword = async (pw) => { const salt = crypto.randomBytes(16); const h = crypto.scryptSync(pw, salt, 64, { N: 16384, r: 8, p: 1 }); return `scrypt$16384$${salt.toString('base64')}$${h.toString('base64')}`; };
const verifyPassword = async (pw, stored) => { try { const [a, N, salt, hash] = String(stored).split('$'); if (a !== 'scrypt') return false; const want = Buffer.from(hash, 'base64'); const got = crypto.scryptSync(String(pw), Buffer.from(salt, 'base64'), want.length, { N: Number(N), r: 8, p: 1 }); return crypto.timingSafeEqual(got, want); } catch (e) { return false; } };
const DUMMY = hashPassword('dummy-password-for-timing');

function makeStore(M) {
  const plain = (d) => d && { ...d.toObject(), id: String(d._id), tenantId: d.tenantId && String(d.tenantId) };
  return {
    findUserByEmail: async (e) => plain(await runUnscoped('sign-in: find the user by email before the venue is known', () => M.User.findOne({ email: e }).select('+passwordHash'))),
    createTenant: async (t) => { const d = await M.Tenant.create(t); return { id: String(d._id) }; },
    createUser: async (u) => { const d = await runUnscoped('sign-up: first user of a brand-new venue', () => M.User.create(u)); return { id: String(d._id) }; },
    updateUser: async (id, patch) => { await runUnscoped('sign-in: failed-attempt count and last login for one user', () => M.User.updateOne({ _id: id }, { $set: patch })); },
  };
}
const KNOWN = { SIGNUP_NAME: 400, SIGNUP_OWNER: 400, SIGNUP_EMAIL: 400, SIGNUP_STATE: 400, SIGNUP_PASSWORD: 400, SIGNUP_PHONE: 400, SIGNUP_TERMS: 400, SIGNUP_EXISTS: 409, LOGIN_BAD: 401, LOGIN_LOCKED: 429 };

function createAuthRouter({ express, mongoose, billing, secret, termsVersion }) {
  if (!secret || secret.length < 32) throw new Error('DINE_SESSION_SECRET must be at least 32 characters');
  const router = express.Router(); const M = makeModels(mongoose); const store = makeStore(M);
  const fail = (res, code, message, extra) => res.status(code).json({ success: false, message, ...extra });
  router.use((req, res, next) => (['GET', 'HEAD', 'OPTIONS'].includes(req.method) || req.headers['x-requested-with'] === 'afra-dine' ? next() : fail(res, 403, 'Request not allowed.')));
  const handle = (fn) => async (req, res) => { try { await fn(req, res); } catch (err) { if (KNOWN[err.code]) return fail(res, KNOWN[err.code], err.message, { code: err.code }); console.error('Dine auth failed:', err.message); return fail(res, 500, 'Server error'); } };

  router.post('/signup', handle(async (req, res) => {
    const r = await signUp(req.body || {}, { store, hash: hashPassword, billing, termsVersion });
    res.setHeader('Set-Cookie', S.cookieHeader(S.sign({ uid: r.userId, tid: r.tenantId, role: 'admin' }, secret)));
    res.status(201).json({ success: true, trialEndsAt: r.trialEndsAt });
  }));
  router.post('/login', handle(async (req, res) => {
    const r = await signIn(req.body || {}, { store, verify: verifyPassword, burn: async (pw) => verifyPassword(pw, await DUMMY) });
    res.setHeader('Set-Cookie', S.cookieHeader(S.sign({ uid: r.userId, tid: r.tenantId, role: r.role }, secret)));
    res.json({ success: true });
  }));
  router.post('/logout', (req, res) => { res.setHeader('Set-Cookie', S.clearCookie()); res.json({ success: true }); });
  router.get('/me', handle(async (req, res) => {
    const p = S.verify(S.readCookie(req.headers.cookie), secret); if (!p) return fail(res, 401, 'Please sign in.');
    const t = await M.Tenant.findById(p.tid); if (!t) return fail(res, 401, 'Please sign in.');
    res.json({ success: true, venueName: t.venueName, role: p.role, subscription: billing.computeStatus(t) });
  }));
  return router;
}

// For the protected router: fills req.user from the cookie. subscriberId-style tenant id is req.user.tenantId.
function sessionMiddleware(secret, M) {
  return async (req, res, next) => {
    const p = S.verify(S.readCookie(req.headers.cookie), secret);
    if (!p || !p.tid || !p.uid) return res.status(401).json({ success: false, message: 'Please sign in.' });
    // The rest of the request (every route handler after this) runs inside the venue's tenant context (C-04 pilot).
    return runWithTenant(String(p.tid), async () => {
      const u = await M.User.findOne({ _id: p.uid, tenantId: p.tid, isActive: { $ne: false } });
      if (!u) return res.status(401).json({ success: false, message: 'Please sign in.' });
      req.user = { id: String(u._id), tenantId: String(u.tenantId), role: u.role, staffRole: u.staffRole || (u.role === 'admin' ? 'owner' : 'manager') }; req.subscription = await M.Tenant.findById(u.tenantId); next();
    });
  };
}
module.exports = { createAuthRouter, sessionMiddleware, hashPassword, verifyPassword };
