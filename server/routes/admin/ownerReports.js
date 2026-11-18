const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../../middleware/auth');
const Subscriber = require('../../models/Subscriber');
const Admin = require('../../models/Admin');
const OwnerReport = require('../../models/OwnerReport');
const svc = require('../../services/ownerReport');

router.use(protect, authorize('admin'));

const gym = async (req, res) => {
  const sub = await Subscriber.findById(req.user.subscriberId);
  if (!sub) { res.status(404).json({ success: false, message: 'Gym not found' }); return null; }
  return sub;
};

// GET /api/admin/owner-reports : the latest finished weekly and monthly reports, a "so far" preview of this week, and recent history
router.get('/', async (req, res) => {
  try {
    const sub = await gym(req, res); if (!sub) return;
    const [weekly, monthly, so_far] = await Promise.all([svc.ensureReport(sub, 'weekly'), svc.ensureReport(sub, 'monthly'), svc.buildReport(sub, 'weekly', new Date(), { partial: true })]);
    const history = await OwnerReport.find({ subscriberId: sub._id }).sort({ createdAt: -1 }).limit(12);
    res.set('Cache-Control', 'no-store');
    res.json({ success: true, data: {
      weekly: svc.view(weekly, sub.gymName), monthly: svc.view(monthly, sub.gymName), thisWeekSoFar: so_far,
      history: history.map((d) => ({ id: String(d._id), period: d.period, label: d.label, status: d.status })),
      settings: { whatsappEnabled: Boolean(sub.whatsappEnabled), reportsAutoSend: sub.automations?.reportsAutoSend === true },
    } });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// POST /api/admin/owner-reports/:id/send : the owner taps Send; goes to the owner's own WhatsApp (approved template), once
router.post('/:id/send', async (req, res) => {
  try {
    const sub = await gym(req, res); if (!sub) return;
    if (!svc.isId(req.params.id)) return res.status(404).json({ success: false, message: 'Report not found' });
    const doc = await OwnerReport.findOne({ _id: req.params.id, subscriberId: sub._id });
    if (!doc) return res.status(404).json({ success: false, message: 'Report not found' });
    if (!sub.whatsappEnabled) return res.status(400).json({ success: false, message: 'Turn on WhatsApp in Settings first.' });
    const owner = await Admin.findById(req.user.id).select('phone name');
    const outcome = await svc.sendReport(sub, owner, doc);
    if (outcome === 'quota') return res.status(400).json({ success: false, message: 'This month\'s WhatsApp messages for your plan are used up.' });
    if (outcome === 'failed' || outcome === 'skipped') return res.status(502).json({ success: false, message: 'The message could not be sent. Try again later.' });
    res.json({ success: true, data: { outcome } });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// POST /api/admin/owner-reports/:id/dismiss
router.post('/:id/dismiss', async (req, res) => {
  try {
    const sub = await gym(req, res); if (!sub) return;
    if (!svc.isId(req.params.id)) return res.status(404).json({ success: false, message: 'Report not found' });
    const r = await OwnerReport.updateOne({ _id: req.params.id, subscriberId: sub._id, status: 'ready' }, { $set: { status: 'dismissed' } });
    if (!r.matchedCount) return res.status(404).json({ success: false, message: 'Report not found' });
    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
