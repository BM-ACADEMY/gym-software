const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../../middleware/auth');
const Subscriber = require('../../models/Subscriber');
const Member = require('../../models/Member');
const Attendance = require('../../models/Attendance');
const Admin = require('../../models/Admin');
const { sendOnce, withinQuota } = require('../../services/automations');
const R = require('../../services/automationRules');
const { logAudit } = require('../../utils/auditLog');

router.use(protect, authorize('admin'));

const optedIn = (m) => m.phone && m.notificationPreferences?.whatsapp !== false;

// GET /api/admin/retention/at-risk
// absent: active members with no check-in for 10+ days. lapsed: membership ended in the last 30 days.
router.get('/at-risk', async (req, res) => {
  try {
    const subscriberId = req.user.subscriberId;
    const now = new Date();
    const [active, lapsed, last] = await Promise.all([
      Member.find({ subscriberId, status: 'active', expiresAt: { $gt: now } }).select('name phone createdAt notificationPreferences').limit(2000).lean(),
      Member.find({ subscriberId, expiresAt: { $lte: now, $gt: new Date(now.getTime() - 30 * R.DAY) } }).select('name phone expiresAt notificationPreferences').limit(500).lean(),
      Attendance.aggregate([{ $match: { subscriberId } }, { $group: { _id: '$memberId', last: { $max: '$checkedInAt' } } }]),
    ]);
    const lastBy = new Map(last.map((x) => [String(x._id), x.last]));
    const absent = active
      .map((m) => ({ id: m._id, name: m.name, phone: m.phone, days: R.absenceDays(lastBy.get(String(m._id)), m.createdAt, now), canMessage: optedIn(m) }))
      .filter((m) => m.days !== null)
      .sort((a, b) => b.days - a.days)
      .slice(0, 100);
    const lapsedOut = lapsed
      .map((m) => ({ id: m._id, name: m.name, phone: m.phone, daysSinceEnd: Math.floor((now - new Date(m.expiresAt)) / R.DAY), canMessage: optedIn(m) }))
      .sort((a, b) => a.daysSinceEnd - b.daysSinceEnd)
      .slice(0, 100);
    res.json({ success: true, data: { absent, lapsed: lapsedOut } });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// POST /api/admin/retention/message { memberId, kind: 'absent' | 'lapsed' }  (one tap)
router.post('/message', async (req, res) => {
  try {
    const { memberId, kind } = req.body || {};
    if (typeof memberId !== 'string' || !['absent', 'lapsed'].includes(kind)) {
      return res.status(400).json({ success: false, message: 'Choose a member and a message type.' });
    }
    const subscriberId = req.user.subscriberId;
    const [sub, member, owner] = await Promise.all([
      Subscriber.findById(subscriberId),
      Member.findOne({ _id: memberId, subscriberId }).catch(() => null),
      Admin.findOne({ subscriberId }).select('phone'),
    ]);
    if (!sub) return res.status(404).json({ success: false, message: 'Gym not found' });
    if (!member) return res.status(404).json({ success: false, message: 'Member not found' });
    if (!sub.whatsappEnabled) return res.status(400).json({ success: false, message: 'Turn on WhatsApp in Settings first.' });
    if (!optedIn(member)) return res.status(400).json({ success: false, message: 'This member has WhatsApp messages switched off.' });

    const now = new Date();
    if (!R.inSendWindow(now)) return res.status(400).json({ success: false, message: 'Messages go out between 9 am and 9 pm. Please try again then.' });
    if (!(await withinQuota(sub, now))) return res.status(402).json({ success: false, planUpgradeRequired: true, message: 'No WhatsApp messages left on your plan this month.' });

    const params = { name: member.name, gym: sub.gymName, phone: owner?.phone || '-' };
    let outcome;
    if (kind === 'absent') {
      const last = await Attendance.findOne({ subscriberId, memberId: member._id }).sort({ checkedInAt: -1 }).select('checkedInAt').lean();
      const days = R.absenceDays(last?.checkedInAt, member.createdAt, now, 1) || 10;
      outcome = await sendOnce({ sub, recipientType: 'member', recipientId: member._id, to: member.phone, type: 'absence_checkin', template: 'gymdesk_absence_checkin', params: { ...params, days }, dedupeKey: `manual:absent:${member._id}:${R.istParts(now).date}`, now });
    } else {
      if (!member.expiresAt || member.expiresAt > now) return res.status(400).json({ success: false, message: 'This membership has not ended yet.' });
      outcome = await sendOnce({ sub, recipientType: 'member', recipientId: member._id, to: member.phone, type: 'winback', template: 'gymdesk_winback', params, dedupeKey: `manual:lapsed:${member._id}:${R.istParts(now).date}`, now });
    }
    await logAudit({ subscriberId, actingRole: 'admin', actingUserId: req.user.id, module: 'retention', action: `${kind}_message:${outcome}`, targetId: member._id });
    if (outcome === 'duplicate') return res.status(409).json({ success: false, message: 'Already messaged today.' });
    if (outcome === 'failed' || outcome === 'skipped') return res.status(502).json({ success: false, message: 'WhatsApp could not deliver this one. Try again later.' });
    res.json({ success: true, data: { outcome } });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
