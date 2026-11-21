'use strict';
// Plugs the sign-in into Express. Returns null (server stays closed) unless every setting is present and valid:
//   ADMIN_SESSION_SECRET (32+ characters), ADMIN_MFA_KEY (32 random bytes, base64), ADMIN_USERS_FILE, ADMIN_AUDIT_FILE
// and at least one user exists (create one with: node apps/admin/scripts/create-admin.js).
const { createFlow } = require('./auth/flow');
const { fileStore, auditFile } = require('./auth/store');
const COOKIE = 'afra_admin';

const parseCookies = (h) => Object.fromEntries(String(h || '').split(';').map((c) => c.trim().split('=')).filter((p) => p[0]).map(([k, ...v]) => [k, decodeURIComponent(v.join('='))]));
const setCookie = (res, value, maxAgeMs) => res.setHeader('Set-Cookie', `${COOKIE}=${encodeURIComponent(value)}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${Math.floor(maxAgeMs / 1000)}`);

function build(env = process.env) {
  const session = env.ADMIN_SESSION_SECRET || ''; const mfaKey = env.ADMIN_MFA_KEY || '';
  if (session.length < 32 || Buffer.from(mfaKey, 'base64').length !== 32 || !env.ADMIN_USERS_FILE || !env.ADMIN_AUDIT_FILE) return null;
  const users = fileStore(env.ADMIN_USERS_FILE);
  if (users.count() < 1) return null;
  const flow = createFlow({ users, secrets: { session, mfaKey }, audit: auditFile(env.ADMIN_AUDIT_FILE) });
  const ipOf = (req) => req.socket && req.socket.remoteAddress; // behind nginx the real address is set by the proxy settings (Dev A)

  // Browsers send this header only from our own page; with SameSite=Strict it blocks cross-site requests.
  const sameSite = (req, res, next) => (['GET', 'HEAD'].includes(req.method) || req.headers['x-requested-with'] === 'afra-admin') ? next() : res.status(403).json({ success: false, message: 'Blocked.' });

  function mount(app) {
    app.post('/api/auth/login', sameSite, async (req, res) => {
      const r = await flow.login({ email: req.body && req.body.email, password: req.body && req.body.password, ip: ipOf(req) });
      return r.ok ? res.json({ success: true, ticket: r.ticket }) : res.status(r.status).json({ success: false, message: r.message });
    });
    app.post('/api/auth/code', sameSite, async (req, res) => {
      const r = await flow.verifyCode({ ticket: req.body && req.body.ticket, code: req.body && req.body.code, ip: ipOf(req) });
      if (!r.ok) return res.status(r.status).json({ success: false, message: r.message });
      setCookie(res, r.session, r.maxAgeMs); res.json({ success: true });
    });
    app.post('/api/auth/logout', sameSite, (req, res) => { setCookie(res, '', 0); res.json({ success: true }); });
    app.get('/api/auth/me', (req, res) => { const s = flow.readSession(parseCookies(req.headers.cookie)[COOKIE]); s ? res.json({ success: true, data: s }) : res.status(401).json({ success: false }); });
  }
  const protect = (req, res, next) => { const s = flow.readSession(parseCookies(req.headers.cookie)[COOKIE]); if (!s) return res.status(401).json({ success: false, message: 'Sign in first.' }); req.user = s; sameSite(req, res, next); };
  const authorize = (...roles) => (req, res, next) => (roles.includes(req.user && req.user.role) ? next() : res.status(403).json({ success: false, message: 'Not allowed.' }));
  return { protect, authorize, mount };
}
const built = build();
module.exports = built ? { ...built, build } : { build };
