const express = require('express');
const router = express.Router();
const {
  registerOtpRequest,
  registerOtpVerify,
  loginAdminWithEmail,
  requestAdminOtp,
  loginAdminWithOtp,
  loginRootAdmin
} = require('../controllers/authController');

// Admin Auth Routes (Gym Owners)
router.post('/register-otp-request', registerOtpRequest);
router.post('/register-otp-verify', registerOtpVerify);
router.post('/login-email', loginAdminWithEmail);
router.post('/request-otp', requestAdminOtp);
router.post('/login-otp', loginAdminWithOtp);

// Root Admin Auth Routes (Platform Owners)
router.post('/login-root', loginRootAdmin);

module.exports = router;
