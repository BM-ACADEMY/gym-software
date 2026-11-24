'use strict';
// RM-11: checks on the payment gateway keys typed into Root Admin > Settings. Pure functions: no database here.
// Main risk when switching test to live: a new key id saved with the OLD secret (the secret box is left blank),
// which makes every order fail. So a new key id needs its own secret typed in the same save.

const KEY_ID = /^rzp_(test|live)_[A-Za-z0-9]{6,40}$/;

// 'live', 'test' or '' (no Razorpay key).
const modeOf = (keyId) => { const m = KEY_ID.exec(String(keyId || '')); return m ? m[1] : ''; };

// body: { provider, keyId, keySecret } from the request; current: what is saved now.
// Returns { value, mode, modeChanged } or { error }.
function validateGatewayUpdate(body, current) {
  const cur = { provider: '', keyId: '', keySecret: '', ...(current || {}) };
  const provider = body.provider !== undefined ? String(body.provider).trim() : cur.provider;
  const keyId = body.keyId !== undefined ? String(body.keyId).trim() : cur.keyId;
  const newSecret = body.keySecret ? String(body.keySecret).trim() : '';
  if (!['', 'razorpay', 'stripe'].includes(provider)) return { error: 'Unknown payment provider' };
  if (provider === 'razorpay') {
    if (!KEY_ID.test(keyId)) return { error: 'The Razorpay key ID should start with rzp_test_ or rzp_live_' };
    if (keyId !== cur.keyId && !newSecret) return { error: 'You changed the key ID. Type the key secret that belongs to it too.' };
    if (newSecret && newSecret === keyId) return { error: 'The key secret is the same as the key ID. Copy the secret from Razorpay.' };
  }
  const value = { ...cur, provider, keyId, keySecret: newSecret || cur.keySecret };
  const mode = provider === 'razorpay' ? modeOf(keyId) : '';
  return { value, mode, modeChanged: Boolean(mode) && mode !== modeOf(cur.keyId) && Boolean(cur.keyId) };
}

module.exports = { modeOf, validateGatewayUpdate };
