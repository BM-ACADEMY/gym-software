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
  resetRootPassword
} = require('../controllers/authController');

// Admin Auth Routes (Gym Owners)
router.post('/register-otp-request', registerOtpRequest);
router.post('/register-otp-verify', registerOtpVerify);
router.post('/login-email', loginAdminWithEmail);
router.post('/request-otp', requestAdminOtp);
router.post('/login-otp', loginAdminWithOtp);

// Shared Phone + Password login for Admin (Gym Owner), Sub-Admin (Staff) and Member (Customer)
router.post('/login-phone', loginWithPhone);

// Shared password reset for Admin, Sub-Admin and Member
router.post('/reset-password-request', requestPasswordReset);
router.post('/reset-password-verify', resetPassword);

// Root Admin Auth Routes (Platform Owners) — kept on its own login page/flow
router.post('/login-root', loginRootAdmin);
router.post('/reset-root-password-request', requestRootPasswordReset);
router.post('/reset-root-password-verify', resetRootPassword);

module.exports = router;
