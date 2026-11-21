const express = require('express');
const router = express.Router();
const Subscriber = require('../models/Subscriber');
const Lead = require('../models/Lead');
const { rateLimit } = require('../middleware/security');
const { computeStatus } = require('../services/subscription');
const { checkNewLead } = require('../services/leadRules');

const DAILY_CAP = 200; // per gym, so a flood of fake entries cannot fill the list

// GET /api/public/leads/:key : the gym name for the enquiry page (and nothing else)
router.get('/:key', rateLimit({ name: 'lead-view', windowMs: 60 * 1000, max: 60 }), async (req, res) => {
  const key = String(req.params.key || '');
  const sub = key.length >= 16 && key.length <= 64 ? await Subscriber.findOne({ leadFormKey: key, isActive: { $ne: false } }).select('gymName brandColor logoUrl paidUntil trialEndsAt planKey isActive suspended').lean().catch(() => null) : null;
  if (!sub) return res.status(404).json({ success: false, message: 'This link is not active.' });
  res.set('Cache-Control', 'no-store');
  res.json({ success: true, data: { gymName: sub.gymName, brandColor: sub.brandColor || null, logoUrl: sub.logoUrl || null } });
});

// POST /api/public/leads/:key : someone fills in the gym's enquiry form. No login. Same answer whether new or repeat.
router.post('/:key', rateLimit({ name: 'lead-post', windowMs: 60 * 60 * 1000, max: 10 }), async (req, res) => {
  try {
    const key = String(req.params.key || '');
    const sub = key.length >= 16 && key.length <= 64 ? await Subscriber.findOne({ leadFormKey: key, isActive: { $ne: false } }) : null;
    if (!sub || computeStatus(sub).readOnly) return res.status(404).json({ success: false, message: 'This link is not active.' });

    // Hidden "website" field: people never fill it, bots do. Pretend it worked.
    if (req.body && typeof req.body.website === 'string' && req.body.website.trim() !== '') return res.status(201).json({ success: true });

    const checked = checkNewLead(req.body, { consentRequired: true });
    if (!checked.ok) return res.status(400).json({ success: false, message: checked.message });

    const since = new Date(Date.now() - 24 * 3600000);
    if ((await Lead.countDocuments({ subscriberId: sub._id, createdAt: { $gte: since } })) >= DAILY_CAP) {
      return res.status(429).json({ success: false, message: 'Too many enquiries today. Please call the gym.' });
    }

    const v = checked.value;
    // A repeat enquiry updates the same lead (never a second row) and puts a finished lead back on the list.
    const existing = await Lead.findOne({ subscriberId: sub._id, phone: v.phone });
    if (existing) {
      existing.enquiries += 1;
      if (existing.status === 'lost') existing.status = 'new';
      if (v.note) existing.note = [existing.note, v.note].filter(Boolean).join(' | ').slice(0, 500);
      await existing.save();
    } else {
      try { await Lead.create({ subscriberId: sub._id, ...v, source: 'form', consentAt: new Date() }); }
      catch (err) { if (err.code !== 11000) throw err; } // two taps at once: the first one counts
    }
    res.status(201).json({ success: true });
  } catch (error) {
    console.error('lead form failed:', error.message);
    res.status(500).json({ success: false, message: 'Something went wrong. Please try again.' });
  }
});

module.exports = router;
