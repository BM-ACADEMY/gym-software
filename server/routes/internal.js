const express = require('express');
const crypto = require('crypto');
const router = express.Router();
const { buildReminders } = require('../services/subscriptionOverview');

// Server-to-server only (n8n or a cron job). Protected by INTERNAL_API_KEY in
// the x-internal-key header. Disabled when the key is not set.
const internalAuth = (req, res, next) => {
  const key = process.env.INTERNAL_API_KEY;
  const given = String(req.headers['x-internal-key'] || '');
  const ok = key && key.length >= 24 && given.length === key.length && crypto.timingSafeEqual(Buffer.from(given), Buffer.from(key));
  if (!ok) return res.status(401).json({ success: false, message: 'Unauthorized' });
  next();
};

// GET /api/internal/billing-reminders
router.get('/billing-reminders', internalAuth, async (req, res) => {
  try {
    res.json({ success: true, data: await buildReminders() });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
