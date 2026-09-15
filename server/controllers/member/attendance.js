const Attendance = require('../../models/Attendance');
const Member = require('../../models/Member');
const Subscriber = require('../../models/Subscriber');
const { computeStreak } = require('../../utils/streak');

const BLOCKED_STATUSES = ['expired', 'frozen', 'cancelled'];

const getEffectiveStatus = (member) => {
  const now = new Date();
  if (member.status === 'active' && member.expiresAt && new Date(member.expiresAt) <= now) return 'expired';
  return member.status;
};

// @desc    Personal attendance calendar & streak
// @route   GET /api/member/attendance
const listMyAttendance = async (req, res) => {
  try {
    const records = await Attendance.find({ memberId: req.user.id }).sort({ checkedInAt: -1 }).limit(200);
    const streak = computeStreak(records.map((r) => r.checkedInAt));
    res.status(200).json({ success: true, message: 'Attendance fetched successfully', data: { records, streak } });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Self check-in (QR) — same block/warn and duplicate-guard rules as staff-marked check-in
// @route   POST /api/member/attendance/check-in
const selfCheckIn = async (req, res) => {
  try {
    const member = await Member.findById(req.user.id);
    if (!member) return res.status(404).json({ success: false, message: 'Member not found' });

    const openSession = await Attendance.findOne({
      subscriberId: req.user.subscriberId,
      memberId: member._id,
      sessionType: 'general',
      checkedOutAt: null,
    }).sort({ checkedInAt: -1 });

    if (openSession) {
      return res.status(200).json({ success: true, message: 'Already checked in', data: { ...openSession.toObject(), duplicate: true } });
    }

    const effectiveStatus = getEffectiveStatus(member);
    let warning;
    if (BLOCKED_STATUSES.includes(effectiveStatus)) {
      const subscriber = await Subscriber.findById(req.user.subscriberId).select('attendanceGraceMode');
      const graceMode = subscriber?.attendanceGraceMode || 'block';
      if (graceMode !== 'warn') {
        return res.status(403).json({ success: false, message: `Check-in blocked — your plan is ${effectiveStatus}.` });
      }
      warning = `Your plan is ${effectiveStatus} — checked in anyway (grace mode).`;
    }

    const attendance = await Attendance.create({
      subscriberId: req.user.subscriberId,
      memberId: member._id,
      checkedInAt: new Date(),
      method: 'qr',
      sessionType: 'general',
    });

    res.status(201).json({ success: true, message: warning || 'Checked in successfully', data: attendance, ...(warning && { warning }) });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

module.exports = { listMyAttendance, selfCheckIn };
