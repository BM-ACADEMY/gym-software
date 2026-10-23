const express = require('express');
const router = express.Router();
const {
  registerOtpRequest,
  registerOtpVerify,
  loginAdminWithEmail,
  requestAdminOtp,
  loginAdminWithOtp,
  loginRootAdmin,
  loginWithPhone,
  requestPasswordReset,
  resetPassword,
  requestRootPasswordReset,
  resetRootPassword,
  requestRootAccess
} = require('../controllers/authController');
const { rateLimit, requireStringAuthFields } = require('../middleware/security');

// Every auth field must be a plain string, then tight limits per client and
// per account. 20 tries / 15 min per IP overall, 8 per IP+account on
// anything that checks a password or OTP, 5 per IP+account on anything that
// sends an OTP SMS.
router.use(requireStringAuthFields);
router.use(rateLimit({ name: 'auth-ip', windowMs: 15 * 60 * 1000, max: 60 }));
const guessLimit = rateLimit({ name: 'auth-guess', windowMs: 15 * 60 * 1000, max: 8, byIdentity: true });
const sendLimit = rateLimit({ name: 'auth-send', windowMs: 15 * 60 * 1000, max: 5, byIdentity: true });

// Public gym sign-up is closed during the pilot (gyms are created by Root
// Admin). Set PUBLIC_SIGNUP=true to reopen it once billing is ready.
const signupGate = (req, res, next) => {
  if (process.env.NODE_ENV === 'production' && process.env.PUBLIC_SIGNUP !== 'true') {
    return res.status(403).json({ success: false, message: 'Sign-up is by invitation only right now.' });
  }
  next();
};

// Admin Auth Routes (Gym Owners)
router.post('/register-otp-request', signupGate, sendLimit, registerOtpRequest);
router.post('/register-otp-verify', signupGate, guessLimit, registerOtpVerify);
router.post('/login-email', guessLimit, loginAdminWithEmail);
router.post('/request-otp', sendLimit, requestAdminOtp);
router.post('/login-otp', guessLimit, loginAdminWithOtp);

// Shared Phone + Password login for Admin (Gym Owner), Sub-Admin (Staff) and Member (Customer)
router.post('/login-phone', guessLimit, loginWithPhone);

// Shared password reset for Admin, Sub-Admin and Member
router.post('/reset-password-request', sendLimit, requestPasswordReset);
router.post('/reset-password-verify', guessLimit, resetPassword);

// Root Admin Auth Routes (Platform Owners) — kept on its own login page/flow
router.post('/login-root', guessLimit, loginRootAdmin);
router.post('/reset-root-password-request', sendLimit, requestRootPasswordReset);
router.post('/reset-root-password-verify', guessLimit, resetRootPassword);
router.post('/request-root-access', sendLimit, requestRootAccess);

module.exports = router;
