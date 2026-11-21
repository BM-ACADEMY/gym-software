'use strict';
// Signed session cookie for Cloth (HMAC-SHA256, Node built-ins only). Secret comes from the server settings, never from git.
const crypto = require('crypto');
const NAME = 'afra_cloth'; const TTL_MS = 12 * 3600 * 1000;
const b64 = (b) => Buffer.from(b).toString('base64url');
function sign(payload, secret, now = Date.now()) {
  if (!secret || secret.length < 32) throw new Error('CLOTH_SESSION_SECRET must be at least 32 characters');
  const body = b64(JSON.stringify({ ...payload, exp: now + TTL_MS }));
  return `${body}.${crypto.createHmac('sha256', secret).update(body).digest('base64url')}`;
}
function verify(token, secret, now = Date.now()) {
  try {
    const [body, mac] = String(token).split('.');
    const want = crypto.createHmac('sha256', secret).update(body).digest();
    const got = Buffer.from(mac, 'base64url');
    if (got.length !== want.length || !crypto.timingSafeEqual(got, want)) return null;
    const p = JSON.parse(Buffer.from(body, 'base64url').toString());
    return p.exp > now ? p : null;
  } catch (e) { return null; }
}
const readCookie = (header, name = NAME) => { const m = String(header || '').split(/;\s*/).find((c) => c.startsWith(name + '=')); return m ? decodeURIComponent(m.slice(name.length + 1)) : ''; };
const cookieHeader = (token) => `${NAME}=${encodeURIComponent(token)}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${TTL_MS / 1000}`;
const clearCookie = () => `${NAME}=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0`;
module.exports = { sign, verify, readCookie, cookieHeader, clearCookie, NAME, TTL_MS };
