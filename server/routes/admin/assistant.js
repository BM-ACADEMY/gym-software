const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../../middleware/auth');
const Subscriber = require('../../models/Subscriber');
const ai = require('../../services/aiAssist');

router.use(protect, authorize('admin'));

const gym = (req) => Subscriber.findById(req.user.subscriberId);

// POST /api/admin/assistant/ask { question }  (Ask GymDesk: answers from the help articles)
router.post('/ask', async (req, res) => {
  try {
    if (typeof req.body?.question !== 'string') return res.status(400).json({ success: false, message: 'Type a question.' });
    const subscriber = await gym(req);
    if (!subscriber) return res.status(404).json({ success: false, message: 'Gym not found' });
    const r = await ai.ask(subscriber, req.body.question);
    if (r.status !== 200) return res.status(r.status).json({ success: false, message: r.message });
    res.json({ success: true, data: r.data });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// GET /api/admin/assistant/insights  (this week's summary for the dashboard, one per day)
router.get('/insights', async (req, res) => {
  try {
    const subscriber = await gym(req);
    if (!subscriber) return res.status(404).json({ success: false, message: 'Gym not found' });
    const { insight, cached } = await ai.getInsight(subscriber);
    const u = await ai.usage(subscriber);
    res.json({ success: true, data: { summary: insight.summary, actions: insight.actions, source: insight.source, day: insight.day, cached, aiRemaining: u.remaining } });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
