const express = require('express');
const router = express.Router();
const {
  registerAdminWithEmail,
  loginAdminWithEmail,
  requestAdminOtp,
  loginAdminWithOtp,
  loginRootAdmin
} = require('../controllers/authController');

// Admin Auth Routes (Gym Owners)
router.post('/register-email', registerAdminWithEmail);
router.post('/login-email', loginAdminWithEmail);
router.post('/request-otp', requestAdminOtp);
router.post('/login-otp', loginAdminWithOtp);

// Root Admin Auth Routes (Platform Owners)
router.post('/login-root', loginRootAdmin);

module.exports = router;
