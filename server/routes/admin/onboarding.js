const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../../middleware/auth');
const Subscriber = require('../../models/Subscriber');
const GymPlan = require('../../models/GymPlan');
const Member = require('../../models/Member');
const SubAdmin = require('../../models/SubAdmin');
const Attendance = require('../../models/Attendance');

// GET /api/admin/onboarding: the "get started" checklist shown on the owner's dashboard.
router.get('/', protect, authorize('admin'), async (req, res) => {
  try {
    const subscriberId = req.user.subscriberId;
    const [sub, plans, members, staff, checkins] = await Promise.all([
      Subscriber.findById(subscriberId).select('state whatsappEnabled upiId logoUrl'),
      GymPlan.countDocuments({ subscriberId }),
      Member.countDocuments({ subscriberId, status: { $ne: 'cancelled' } }),
      SubAdmin.countDocuments({ subscriberId }),
      Attendance.countDocuments({ subscriberId }),
    ]);
    const steps = [
      { key: 'plans', title: 'Create your membership plans', hint: 'Monthly, quarterly, yearly: whatever you sell.', path: '/admin/plan-creation', done: plans > 0 },
      { key: 'members', title: 'Add or import your members', hint: 'Upload your Excel sheet in a few clicks.', path: '/admin/import', done: members > 0 },
      { key: 'whatsapp', title: 'Turn on WhatsApp reminders', hint: 'Renewals and pending payments go out by themselves.', path: '/admin/settings', done: Boolean(sub?.whatsappEnabled) },
      { key: 'checkin', title: 'Try a check-in', hint: 'Scan a member QR or mark attendance.', path: '/admin/attendance', done: checkins > 0 },
      { key: 'staff', title: 'Add a staff login (optional)', hint: 'Give your trainer or receptionist their own access.', path: '/admin/staff', done: staff > 0, optional: true },
    ];
    res.json({ success: true, data: { steps, completed: steps.filter((s) => s.done).length, total: steps.length, allDone: steps.filter((s) => !s.optional).every((s) => s.done) } });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
