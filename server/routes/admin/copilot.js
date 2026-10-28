const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../../middleware/auth');
const Subscriber = require('../../models/Subscriber');
const copilot = require('../../services/renewalCopilot');
const { logAudit } = require('../../utils/auditLog');

router.use(protect, authorize('admin'));

const gym = (req) => Subscriber.findById(req.user.subscriberId);

// GET /api/admin/copilot/today?lang=en|ta|hi
router.get('/today', async (req, res) => {
  try {
    const sub = await gym(req);
    if (!sub) return res.status(404).json({ success: false, message: 'Gym not found' });
    const lang = typeof req.query.lang === 'string' ? req.query.lang : undefined;
    res.json({ success: true, data: await copilot.getToday(sub, { lang }) });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// POST /api/admin/copilot/done { memberId, kind }  (owner tapped WhatsApp / marked contacted)
router.post('/done', async (req, res) => {
  try {
    const { memberId, kind } = req.body || {};
    if (typeof memberId !== 'string' || typeof kind !== 'string') return res.status(400).json({ success: false, message: 'Choose a member and a reason.' });
    const sub = await gym(req);
    if (!sub) return res.status(404).json({ success: false, message: 'Gym not found' });
    const r = await copilot.markDone(sub, memberId, kind, req.user.id);
    if (r.status !== 200) return res.status(r.status).json({ success: false, message: r.message });
    await logAudit({ subscriberId: sub._id, actingRole: 'admin', actingUserId: req.user.id, module: 'copilot', action: `contacted:${kind}`, targetId: memberId });
    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// POST /api/admin/copilot/polish { kind, lang, tone }  (AI rewrite of a template, counts toward the AI cap)
router.post('/polish', async (req, res) => {
  try {
    const { kind, lang, tone } = req.body || {};
    if (typeof kind !== 'string') return res.status(400).json({ success: false, message: 'Choose a reason.' });
    const sub = await gym(req);
    if (!sub) return res.status(404).json({ success: false, message: 'Gym not found' });
    const r = await copilot.polish(sub, { kind, lang: typeof lang === 'string' ? lang : undefined, tone: typeof tone === 'string' ? tone : undefined });
    if (r.status !== 200) return res.status(r.status).json({ success: false, message: r.message });
    res.json({ success: true, data: r.data });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
