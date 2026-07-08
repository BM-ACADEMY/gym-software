const express = require('express');
const router = express.Router();
const { getSettings, updateOtpMode } = require('../controllers/settingsController');
const { protect, authorize } = require('../middleware/auth');

// All settings routes require root_admin
router.get('/', protect, authorize('root_admin'), getSettings);
router.put('/otp-mode', protect, authorize('root_admin'), updateOtpMode);

module.exports = router;
