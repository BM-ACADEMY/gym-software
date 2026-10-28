'use strict';
// Sign-in building blocks using only Node's built-in crypto: password hashing (scrypt), one-time codes (TOTP, RFC 6238),
// signed tickets and sessions (HMAC-SHA256), and encryption of the two-step secret (AES-256-GCM).
const crypto = require('crypto');
const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

// ---- passwords ----
const SCRYPT = { N: 16384, r: 8, p: 1, keylen: 64 };
function hashPassword(pw) {
  if (typeof pw !== 'string' || pw.length < 12) throw Object.assign(new Error('password must be at least 12 characters'), { code: 'WEAK_PASSWORD' });
  const salt = crypto.randomBytes(16);
  const h = crypto.scryptSync(pw, salt, SCRYPT.keylen, { N: SCRYPT.N, r: SCRYPT.r, p: SCRYPT.p });
  return `scrypt$${SCRYPT.N}$${salt.toString('base64')}$${h.toString('base64')}`;
}
function verifyPassword(pw, stored) {
  try {
    const [alg, N, salt, hash] = String(stored).split('$');
    if (alg !== 'scrypt') return false;
    const want = Buffer.from(hash, 'base64');
    const got = crypto.scryptSync(String(pw), Buffer.from(salt, 'base64'), want.length, { N: Number(N), r: SCRYPT.r, p: SCRYPT.p });
    return got.length === want.length && crypto.timingSafeEqual(got, want);
  } catch (e) { return false; }
}
// Used when the email is unknown, so the time taken does not reveal which emails exist.
const DUMMY = hashPassword('dummy-password-for-timing');
const burnTime = (pw) => { verifyPassword(pw, DUMMY); };

// ---- base32 + TOTP ----
function base32Encode(buf) { let bits = '', out = ''; for (const b of buf) bits += b.toString(2).padStart(8, '0'); for (let i = 0; i < bits.length; i += 5) out += B32[parseInt(bits.slice(i, i + 5).padEnd(5, '0'), 2)]; return out; }
function base32Decode(s) { let bits = ''; for (const c of String(s).replace(/=+$/, '').toUpperCase()) { const v = B32.indexOf(c); if (v < 0) throw new Error('bad base32'); bits += v.toString(2).padStart(5, '0'); } const bytes = []; for (let i = 0; i + 8 <= bits.length; i += 8) bytes.push(parseInt(bits.slice(i, i + 8), 2)); return Buffer.from(bytes); }
const newTotpSecret = () => base32Encode(crypto.randomBytes(20));
function hotp(secretBuf, counter, digits = 6) {
  const msg = Buffer.alloc(8); msg.writeBigUInt64BE(BigInt(counter));
  const h = crypto.createHmac('sha1', secretBuf).update(msg).digest();
  const o = h[h.length - 1] & 0xf;
  const code = ((h[o] & 0x7f) << 24) | (h[o + 1] << 16) | (h[o + 2] << 8) | h[o + 3];
  return String(code % 10 ** digits).padStart(digits, '0');
}
const stepOf = (ms) => Math.floor(ms / 1000 / 30);
// Accepts the current step and one either side (clock drift). Returns the matched step so the caller can refuse a reuse.
function verifyTotp(secretB32, code, nowMs = Date.now(), digits = 6) {
  if (!/^\d{6}$/.test(String(code || '').trim())) return null;
  const secret = base32Decode(secretB32); const cur = stepOf(nowMs);
  for (const s of [cur, cur - 1, cur + 1]) {
    const a = Buffer.from(hotp(secret, s, digits)); const b = Buffer.from(String(code).trim());
    if (a.length === b.length && crypto.timingSafeEqual(a, b)) return s;
  }
  return null;
}
const otpauthUri = (email, secret, issuer = 'Afra Super Admin') => `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(email)}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&digits=6&period=30`;

// ---- signed tokens (tickets, sessions) ----
const b64u = (b) => Buffer.from(b).toString('base64url');
function sign(payload, secret) {
  const body = b64u(JSON.stringify(payload));
  return `${body}.${crypto.createHmac('sha256', secret).update(body).digest('base64url')}`;
}
function verifySigned(token, secret, nowMs = Date.now()) {
  const [body, mac] = String(token || '').split('.');
  if (!body || !mac) return null;
  const want = crypto.createHmac('sha256', secret).update(body).digest();
  let got; try { got = Buffer.from(mac, 'base64url'); } catch (e) { return null; }
  if (got.length !== want.length || !crypto.timingSafeEqual(got, want)) return null;
  try { const p = JSON.parse(Buffer.from(body, 'base64url').toString()); return p.exp && p.exp > nowMs ? p : null; } catch (e) { return null; }
}

// ---- encrypt the two-step secret at rest ----
function encrypt(plain, keyB64) {
  const key = Buffer.from(keyB64, 'base64'); if (key.length !== 32) throw new Error('key must be 32 bytes (base64)');
  const iv = crypto.randomBytes(12); const c = crypto.createCipheriv('aes-256-gcm', key, iv);
  const enc = Buffer.concat([c.update(plain, 'utf8'), c.final()]);
  return `${iv.toString('base64')}.${c.getAuthTag().toString('base64')}.${enc.toString('base64')}`;
}
function decrypt(blob, keyB64) {
  const key = Buffer.from(keyB64, 'base64'); const [iv, tag, enc] = String(blob).split('.').map((x) => Buffer.from(x, 'base64'));
  const d = crypto.createDecipheriv('aes-256-gcm', key, iv); d.setAuthTag(tag);
  return Buffer.concat([d.update(enc), d.final()]).toString('utf8');
}
const sha256 = (s) => crypto.createHash('sha256').update(String(s)).digest('hex');
module.exports = { hashPassword, verifyPassword, burnTime, base32Encode, base32Decode, newTotpSecret, hotp, verifyTotp, stepOf, otpauthUri, sign, verifySigned, encrypt, decrypt, sha256 };
