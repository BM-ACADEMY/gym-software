'use strict';
// Shop sign-up and sign-in rules for Cloth. No database or network here: the store, password hashing and clock are passed in.
// Every new shop starts a trial (length comes from the billing config). Wrong passwords lock the account for a while.
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const MAX_FAILS = 5; const LOCK_MS = 15 * 60 * 1000; const MIN_PASSWORD = 10;
const err = (code, message) => Object.assign(new Error(message), { code });
const cleanEmail = (e) => String(e || '').trim().toLowerCase();

async function signUp(input, { store, hash, billing, now = new Date(), termsVersion }) {
  const shopName = String((input && input.shopName) || '').trim();
  const ownerName = String((input && input.ownerName) || '').trim();
  const email = cleanEmail(input && input.email);
  const state = String((input && input.state) || '').trim();
  const password = String((input && input.password) || '');
  if (shopName.length < 2 || shopName.length > 120) throw err('SIGNUP_NAME', 'Enter your shop name.');
  if (ownerName.length < 2) throw err('SIGNUP_OWNER', 'Enter your name.');
  if (!EMAIL.test(email)) throw err('SIGNUP_EMAIL', 'Enter a valid email address.');
  if (!state) throw err('SIGNUP_STATE', 'Select your state. It decides how GST shows on your invoice.');
  if (password.length < MIN_PASSWORD) throw err('SIGNUP_PASSWORD', `Password must be at least ${MIN_PASSWORD} characters.`);
  if (!input.acceptTerms) throw err('SIGNUP_TERMS', 'Please accept the terms and privacy policy to continue.');
  const phone = String((input && input.phone) || '').replace(/[^\d+]/g, '');
  const salesContactOk = input.salesContactOk === true;
  if (salesContactOk && !/^\+?\d{10,15}$/.test(phone)) throw err('SIGNUP_PHONE', 'Enter a phone number we can call you on, or untick the call option.');
  if (phone && !/^\+?\d{10,15}$/.test(phone)) throw err('SIGNUP_PHONE', 'That phone number does not look right.');
  if (await store.findUserByEmail(email)) throw err('SIGNUP_EXISTS', 'An account with this email already exists. Sign in instead.');
  const { trialEndsAt } = billing.trialDates(now);
  const tenant = await store.createTenant({ shopName, state, trialEndsAt, createdAt: now, termsAcceptedAt: now, termsVersion: termsVersion || null, currency: 'INR' });
  const user = await store.createUser({ tenantId: tenant.id, name: ownerName, email, role: 'admin', phone: phone || undefined, salesContactOk, salesContactAt: salesContactOk ? now : undefined, passwordHash: await hash(password), failedLogins: 0, createdAt: now });
  return { tenantId: tenant.id, userId: user.id, trialEndsAt };
}

async function signIn({ email, password }, { store, verify, burn, now = new Date() }) {
  const user = await store.findUserByEmail(cleanEmail(email));
  const bad = err('LOGIN_BAD', 'Email or password is wrong.');
  if (!user) { if (burn) await burn(password); throw bad; }
  if (user.lockedUntil && new Date(user.lockedUntil) > now) throw err('LOGIN_LOCKED', 'Too many tries. Please wait 15 minutes and try again.');
  if (user.isActive === false) throw bad;
  if (!(await verify(password, user.passwordHash))) {
    const fails = (user.lockedUntil && new Date(user.lockedUntil) <= now ? 0 : user.failedLogins || 0) + 1;
    await store.updateUser(user.id, fails >= MAX_FAILS ? { failedLogins: 0, lockedUntil: new Date(now.getTime() + LOCK_MS) } : { failedLogins: fails });
    throw bad;
  }
  await store.updateUser(user.id, { failedLogins: 0, lockedUntil: null, lastLoginAt: now });
  return { userId: user.id, tenantId: user.tenantId, role: user.role };
}
module.exports = { signUp, signIn, MAX_FAILS, LOCK_MS, MIN_PASSWORD };
