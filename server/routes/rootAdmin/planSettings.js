const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../../middleware/auth');
const store = require('../../services/planSettings');

// SET-01: Root Admin edits plan prices and limits without a deploy. Owner only. Every change needs a reason and is kept in the history.
router.use(protect, authorize('root_admin'));
const who = (req) => String((req.user && (req.user.email || req.user.id)) || 'unknown');

router.get('/', (req, res) => { res.set('Cache-Control', 'no-store'); res.json({ success: true, data: store.get().view() }); });

// Trial length (days). Only affects gyms that sign up after the change. Declared before '/:key'.
router.put('/trial', async (req, res) => {
  try {
    const { days, reason } = req.body || {};
    const r = await store.get().saveTrial(days, who(req), reason);
    if (r.error) return res.status(400).json({ success: false, message: r.error });
    res.json({ success: true, data: store.get().view() });
  } catch (e) { console.error('trial save failed:', e.message); res.status(500).json({ success: false, message: 'Server error' }); }
});

router.put('/:key', async (req, res) => {
  try {
    const { reason, confirmBelowFloor, ...patch } = req.body || {};
    const r = await store.get().save(String(req.params.key), patch, who(req), reason, confirmBelowFloor);
    if (r.error) return res.status(400).json({ success: false, message: r.error });
    if (r.needsConfirm) return res.status(409).json({ success: false, needsConfirm: true, warnings: r.warnings, message: r.warnings[0].message });
    res.json({ success: true, warnings: r.warnings, data: store.get().view() });
  } catch (e) { console.error('plan settings save failed:', e.message); res.status(500).json({ success: false, message: 'Server error' }); }
});

router.post('/:key/reset', async (req, res) => {
  try {
    const r = await store.get().reset(String(req.params.key), who(req), (req.body || {}).reason);
    if (r.error) return res.status(400).json({ success: false, message: r.error });
    res.json({ success: true, data: store.get().view() });
  } catch (e) { console.error('plan settings reset failed:', e.message); res.status(500).json({ success: false, message: 'Server error' }); }
});
module.exports = router;
