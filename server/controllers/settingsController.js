const SystemSettings = require('../models/SystemSettings');

// @desc    Get all system settings (root admin only)
// @route   GET /api/settings
const getSettings = async (req, res) => {
  try {
    const otpMode = await SystemSettings.getSetting('otp_mode', process.env.OTP_MODE || 'demo');
    res.json({
      success: true,
      data: {
        otpMode
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Update OTP mode (root admin only)
// @route   PUT /api/settings/otp-mode
const updateOtpMode = async (req, res) => {
  try {
    const { mode } = req.body;

    if (!['demo', 'live'].includes(mode)) {
      return res.status(400).json({ success: false, message: 'Mode must be "demo" or "live"' });
    }

    await SystemSettings.setSetting(
      'otp_mode',
      mode,
      'Controls whether OTP is sent via live SMS/Email or shown in the UI for testing'
    );

    res.json({
      success: true,
      message: `OTP mode switched to "${mode}"`,
      data: { otpMode: mode }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

module.exports = { getSettings, updateOtpMode };
