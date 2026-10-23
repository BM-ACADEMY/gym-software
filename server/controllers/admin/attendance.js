const Attendance = require('../../models/Attendance');
const Member = require('../../models/Member');
const Subscriber = require('../../models/Subscriber');
const PTSession = require('../../models/PTSession');

const METHODS = ['qr', 'code', 'manual', 'biometric'];
const BLOCKED_STATUSES = ['expired', 'frozen', 'cancelled'];

const getModulePermission = (subAdmin, moduleKey) =>
  subAdmin?.permissions?.get?.(moduleKey) || subAdmin?.permissions?.[moduleKey];

// Same data-boundary rule as Members: a sub-admin without "view all" only
// touches attendance for members assigned to them.
const getSubAdminScope = (req) => {
  if (req.user.role !== 'subadmin') return { scoped: false };
  const perm = getModulePermission(req.subAdmin, 'attendance');
  return { scoped: !perm?.viewAll, subAdminId: req.user.id };
};

// A member's plan may say "active" while already past expiresAt — this
// mirrors the effective-status logic from the Members module.
const getEffectiveStatus = (member) => {
  const now = new Date();
  if (member.status === 'active' && member.expiresAt && new Date(member.expiresAt) <= now) return 'expired';
  return member.status;
};

const dayBounds = (dateStr) => {
  const start = dateStr ? new Date(dateStr) : new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start, end };
};

// Supports either a single `date` (back-compat, defaults to today) or a
// `dateFrom`/`dateTo` range for history browsing across multiple days.
const rangeBounds = ({ date, dateFrom, dateTo }) => {
  if (dateFrom || dateTo) {
    const start = dateFrom ? new Date(dateFrom) : new Date(0);
    start.setHours(0, 0, 0, 0);
    const end = dateTo ? new Date(dateTo) : new Date();
    end.setHours(23, 59, 59, 999);
    return { start, end };
  }
  return dayBounds(date);
};

// @desc    Check a member in — enforces the expired/frozen block (or warn) rule
//          and silently no-ops a duplicate tap while a session is still open.
// @route   POST /api/admin/attendance  |  POST /api/subadmin/attendance (edit)
const checkIn = async (req, res) => {
  try {
    const { memberId, method, sessionType = 'general', ptSessionId } = req.body;

    if (!memberId || !METHODS.includes(method)) {
      return res.status(400).json({ success: false, message: `memberId and a valid method (${METHODS.join('/')}) are required` });
    }
    if (!['general', 'pt_session'].includes(sessionType)) {
      return res.status(400).json({ success: false, message: 'sessionType must be general or pt_session' });
    }
    if (sessionType === 'pt_session' && !ptSessionId) {
      return res.status(400).json({ success: false, message: 'ptSessionId is required for a PT session check-in' });
    }

    const member = await Member.findOne({ _id: memberId, subscriberId: req.user.subscriberId });
    if (!member) {
      return res.status(404).json({ success: false, message: 'Member not found' });
    }

    const { scoped, subAdminId } = getSubAdminScope(req);
    if (scoped && String(member.assignedSubAdminId) !== String(subAdminId)) {
      return res.status(403).json({ success: false, message: 'This member is not assigned to you' });
    }

    let ptSession;
    if (sessionType === 'pt_session') {
      ptSession = await PTSession.findOne({ _id: ptSessionId, subscriberId: req.user.subscriberId, memberId });
      if (!ptSession) {
        return res.status(404).json({ success: false, message: 'PT session not found for this member' });
      }
      if (ptSession.status !== 'scheduled') {
        return res.status(400).json({ success: false, message: `This PT session is already ${ptSession.status}` });
      }
    }

    // "One check-in per member per session" + the 2-minute double-tap guard
    // both fall out of the same rule: don't open a second session while one
    // is already open for this member/sessionType.
    const openSession = await Attendance.findOne({
      subscriberId: req.user.subscriberId,
      memberId,
      sessionType,
      checkedOutAt: null,
    }).sort({ checkedInAt: -1 });

    if (openSession) {
      return res.status(200).json({
        success: true,
        message: 'Member is already checked in',
        data: { ...openSession.toObject(), duplicate: true },
      });
    }

    const effectiveStatus = getEffectiveStatus(member);
    let warning;
    if (BLOCKED_STATUSES.includes(effectiveStatus)) {
      const subscriber = await Subscriber.findById(req.user.subscriberId).select('attendanceGraceMode');
      const graceMode = subscriber?.attendanceGraceMode || 'block';
      if (graceMode !== 'warn') {
        return res.status(403).json({
          success: false,
          message: `Check-in blocked — this member's plan is ${effectiveStatus}.`,
        });
      }
      warning = `This member's plan is ${effectiveStatus} — checked in anyway (grace mode).`;
    }

    const attendance = await Attendance.create({
      subscriberId: req.user.subscriberId,
      memberId,
      checkedInAt: new Date(),
      method,
      markedBy: req.user.role === 'subadmin' ? req.user.id : undefined,
      sessionType,
      ptSessionId: sessionType === 'pt_session' ? ptSessionId : undefined,
    });

    // Checking in for a PT session IS attending it — keep the session record in sync.
    if (ptSession) {
      ptSession.status = 'completed';
      await ptSession.save();
    }

    res.status(201).json({
      success: true,
      message: warning || 'Checked in successfully',
      data: attendance,
      ...(warning && { warning }),
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Check a member in from a scanned QR code (member's own check-in QR,
//          generated by utils/qrcode.js) — decodes {sid, mid}, confirms the
//          code belongs to this gym, then runs the exact same check-in path
//          as a manual tap so every block/warn/duplicate rule still applies.
// @route   POST /api/admin/attendance/scan  |  POST /api/subadmin/attendance/scan (edit)
const scanCheckIn = async (req, res) => {
  try {
    const { payload } = req.body;
    if (!payload) {
      return res.status(400).json({ success: false, message: 'payload is required' });
    }

    let parsed;
    try {
      parsed = JSON.parse(payload);
    } catch {
      return res.status(400).json({ success: false, message: 'Unrecognized QR code' });
    }

    if (!parsed.mid || !parsed.sid) {
      return res.status(400).json({ success: false, message: 'Unrecognized QR code' });
    }
    if (String(parsed.sid) !== String(req.user.subscriberId)) {
      return res.status(403).json({ success: false, message: 'This QR code belongs to a different gym' });
    }

    req.body = { memberId: parsed.mid, method: 'qr', sessionType: 'general' };
    return checkIn(req, res);
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Check a member out (optional — enables duration analytics)
// @route   PATCH /api/admin/attendance/:id/check-out  |  PATCH /api/subadmin/attendance/:id/check-out (edit)
const checkOut = async (req, res) => {
  try {
    const attendance = await Attendance.findOne({ _id: req.params.id, subscriberId: req.user.subscriberId });
    if (!attendance) {
      return res.status(404).json({ success: false, message: 'Attendance record not found' });
    }

    const { scoped, subAdminId } = getSubAdminScope(req);
    if (scoped) {
      const member = await Member.findById(attendance.memberId).select('assignedSubAdminId');
      if (!member || String(member.assignedSubAdminId) !== String(subAdminId)) {
        return res.status(403).json({ success: false, message: 'This member is not assigned to you' });
      }
    }

    if (attendance.checkedOutAt) {
      return res.status(400).json({ success: false, message: 'Already checked out' });
    }

    attendance.checkedOutAt = new Date();
    await attendance.save();

    res.status(200).json({ success: true, message: 'Checked out successfully', data: attendance });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    List attendance records for a day (default today), optionally filtered
// @route   GET /api/admin/attendance  |  GET /api/subadmin/attendance (view)
const listAttendance = async (req, res) => {
  try {
    const { date, dateFrom, dateTo, memberId, sessionType, method } = req.query;
    const { start, end } = rangeBounds({ date, dateFrom, dateTo });

    const query = {
      subscriberId: req.user.subscriberId,
      checkedInAt: { $gte: start, $lte: end },
    };
    if (memberId) query.memberId = memberId;
    if (sessionType) query.sessionType = sessionType;
    if (method) query.method = method;

    const { scoped, subAdminId } = getSubAdminScope(req);
    if (scoped) {
      const ownMemberIds = await Member.find({ subscriberId: req.user.subscriberId, assignedSubAdminId: subAdminId }).distinct('_id');
      query.memberId = query.memberId ? query.memberId : { $in: ownMemberIds };
    }

    const records = await Attendance.find(query)
      .populate('memberId', 'name phone')
      .populate('markedBy', 'name')
      .sort({ checkedInAt: -1 })
      .limit(500);

    res.status(200).json({ success: true, message: 'Attendance fetched successfully', data: records });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Quick today-glance counts for the Attendance page header
// @route   GET /api/admin/attendance/today-summary  |  GET /api/subadmin/attendance/today-summary (view)
const todaySummary = async (req, res) => {
  try {
    const { start, end } = dayBounds();
    const query = { subscriberId: req.user.subscriberId, checkedInAt: { $gte: start, $lt: end } };

    const { scoped, subAdminId } = getSubAdminScope(req);
    if (scoped) {
      const ownMemberIds = await Member.find({ subscriberId: req.user.subscriberId, assignedSubAdminId: subAdminId }).distinct('_id');
      query.memberId = { $in: ownMemberIds };
    }

    const [checkedInToday, currentlyInside] = await Promise.all([
      Attendance.countDocuments(query),
      Attendance.countDocuments({ ...query, checkedOutAt: null }),
    ]);

    res.status(200).json({ success: true, message: 'Summary fetched successfully', data: { checkedInToday, currentlyInside } });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

module.exports = { checkIn, checkOut, listAttendance, todaySummary, scanCheckIn };
