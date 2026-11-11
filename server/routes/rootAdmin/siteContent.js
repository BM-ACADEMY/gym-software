const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../../middleware/auth');
const live = require('../../services/siteContentLive');

// D-28: Root Admin edits the public site wording (pricing page, landing page, FAQ, help articles) without a deploy.
// Owner only. Every change needs a reason and is kept in the history. Text only; wording that promises unbuilt features is refused.
router.use(protect, authorize('root_admin'));
const who = (req) => String((req.user && (req.user.email || req.user.id)) || 'unknown');
const fail500 = (res, e, what) => { console.error(`site content ${what} failed:`, e.message); res.status(500).json({ success: false, message: 'Server error' }); };

router.get('/', (req, res) => { res.set('Cache-Control', 'no-store'); res.json({ success: true, data: live.get().view() }); });

router.put('/:section', async (req, res) => {
  try {
    const { reason, value } = req.body || {};
    const r = await live.get().save(String(req.params.section), value, who(req), reason);
    if (r.error) return res.status(400).json({ success: false, message: r.error });
    res.json({ success: true, data: live.get().view() });
  } catch (e) { fail500(res, e, 'save'); }
});

router.post('/:section/reset', async (req, res) => {
  try {
    const r = await live.get().reset(String(req.params.section), who(req), (req.body || {}).reason);
    if (r.error) return res.status(400).json({ success: false, message: r.error });
    res.json({ success: true, data: live.get().view() });
  } catch (e) { fail500(res, e, 'reset'); }
});
module.exports = router;
