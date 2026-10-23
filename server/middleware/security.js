// Small, dependency-free hardening for the pilot launch: security headers,
// NoSQL-operator rejection, string-only auth fields, and an in-memory rate
// limiter. The limiter is per server process, which is fine for a single
// instance; move it to Redis (or express-rate-limit with a store) before
// running more than one instance.

const isProduction = () => process.env.NODE_ENV === 'production';

// --- Security headers (the useful subset of what helmet sets) -------------
const securityHeaders = (req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('X-DNS-Prefetch-Control', 'off');
  res.setHeader('Cross-Origin-Resource-Policy', 'same-site');
  res.removeHeader('X-Powered-By');
  if (isProduction()) {
    res.setHeader('Strict-Transport-Security', 'max-age=15552000; includeSubDomains');
  }
  next();
};

// --- CORS allow-list --------------------------------------------------------
// CORS_ORIGINS="https://app.example.com,https://www.example.com"
// Outside production, every origin is allowed so local dev keeps working.
// In production with no list set, cross-origin browser requests are refused.
const corsOptions = () => {
  const allowed = (process.env.CORS_ORIGINS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  return {
    exposedHeaders: ['X-Gym-Suspended'],
    origin: (origin, callback) => {
      if (!origin) return callback(null, true); // same-origin, curl, server-to-server
      if (!isProduction()) return callback(null, true);
      return callback(null, allowed.includes(origin));
    },
  };
};

// --- NoSQL operator rejection ---------------------------------------------
// Rejects any request whose body, query or params contain a key starting
// with "$", e.g. { "phone": { "$ne": null } }.
const hasBadKey = (value, depth = 0) => {
  if (depth > 8 || value === null || typeof value !== 'object') return false;
  if (Array.isArray(value)) return value.some((v) => hasBadKey(v, depth + 1));
  return Object.keys(value).some((k) => k.startsWith('$') || hasBadKey(value[k], depth + 1));
};

const rejectOperatorKeys = (req, res, next) => {
  if (hasBadKey(req.body) || hasBadKey(req.query) || hasBadKey(req.params)) {
    return res.status(400).json({ success: false, message: 'Invalid request' });
  }
  next();
};

// Credential-style fields must be plain strings (blocks objects and arrays).
const AUTH_STRING_FIELDS = ['phone', 'email', 'password', 'newPassword', 'currentPassword', 'otp', 'identifier', 'type', 'name', 'gymName', 'ownerName'];

const requireStringAuthFields = (req, res, next) => {
  const body = req.body || {};
  for (const field of AUTH_STRING_FIELDS) {
    if (body[field] !== undefined && typeof body[field] !== 'string') {
      return res.status(400).json({ success: false, message: `${field} must be a string` });
    }
  }
  next();
};

// --- Rate limiter -----------------------------------------------------------
const buckets = new Map();

const cleanup = () => {
  const now = Date.now();
  for (const [key, entry] of buckets) {
    if (entry.resetAt <= now) buckets.delete(key);
  }
};
setInterval(cleanup, 5 * 60 * 1000).unref();

const bodyIdentity = (req) => {
  const b = req.body || {};
  const id = b.phone || b.email || b.identifier;
  return typeof id === 'string' ? id.trim().toLowerCase().slice(0, 100) : '';
};

// rateLimit({ windowMs, max, name, byIdentity })
// byIdentity=true counts per (ip + phone/email in the body), which is what
// stops OTP guessing on one account even from many IPs combined with the
// per-IP limit below it.
const rateLimit = ({ windowMs, max, name, byIdentity = false }) => (req, res, next) => {
  if (process.env.NODE_ENV === 'test' && !process.env.RATE_LIMIT_IN_TESTS) return next();

  const key = `${name}|${req.ip}|${byIdentity ? bodyIdentity(req) : ''}`;
  const now = Date.now();
  let entry = buckets.get(key);
  if (!entry || entry.resetAt <= now) {
    entry = { count: 0, resetAt: now + windowMs };
    buckets.set(key, entry);
  }
  entry.count += 1;

  if (entry.count > max) {
    const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
    res.setHeader('Retry-After', String(retryAfter));
    return res.status(429).json({ success: false, message: 'Too many attempts. Please try again later.' });
  }
  next();
};

const _resetRateLimits = () => buckets.clear();

module.exports = {
  securityHeaders,
  corsOptions,
  rejectOperatorKeys,
  requireStringAuthFields,
  rateLimit,
  _resetRateLimits,
};
