const express = require('express');
const crypto = require('crypto');
const router = express.Router();
const { buildReminders } = require('../services/subscriptionOverview');
const { buildSummary } = require('../services/adminSummary');
const { buildAccounts } = require('../services/adminAccounts');

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

// GET /api/internal/admin-summary: counts and rupee totals for the all-products Super Admin (read only).
router.get('/admin-summary', internalAuth, async (req, res) => {
  try {
    res.json({ success: true, data: await buildSummary() });
  } catch (error) {
    console.error('admin-summary failed:', error.message);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// GET /api/internal/admin-accounts: owner contact and plan status per gym, for the sales list in Super Admin (CRM-03).
// Contains the owner's phone and email, so it is never logged and the key must travel over https only.
router.get('/admin-accounts', internalAuth, async (req, res) => {
  try {
    res.set('Cache-Control', 'no-store');
    res.json({ success: true, data: await buildAccounts() });
  } catch (error) {
    console.error('admin-accounts failed:', error.message);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
