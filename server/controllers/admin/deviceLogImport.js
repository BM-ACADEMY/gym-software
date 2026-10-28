const Member = require('../../models/Member');
const SubAdmin = require('../../models/SubAdmin');
const Attendance = require('../../models/Attendance');
const StaffAttendance = require('../../models/StaffAttendance');
const Subscriber = require('../../models/Subscriber');
const { parseRows, collapse, DEDUPE_MS } = require('../../services/deviceLogImport');
const { logAudit } = require('../../utils/auditLog');

// Gym-local calendar day (yyyy-mm-dd) of an instant.
const localDate = (instant, tz) => new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(instant);

// @desc    Import punches exported from a biometric/card device (CSV or Excel).
//          Members' punches become check-ins; staff punches become staff attendance.
// @route   POST /api/admin/attendance/device-log   { rows: [...], commit: boolean }
const importDeviceLog = async (req, res) => {
  try {
    const { rows, commit } = req.body;
    if (!Array.isArray(rows) || rows.some((r) => !r || typeof r !== 'object' || Array.isArray(r))) {
      return res.status(400).json({ success: false, message: 'rows must be a list of rows' });
    }
    const subscriberId = req.user.subscriberId;
    const sub = await Subscriber.findById(subscriberId).select('timezone');
    const tz = sub?.timezone || 'Asia/Kolkata';

    const parsed = parseRows(rows, tz);
    if (parsed.fatal) return res.status(400).json({ success: false, message: parsed.fatal });

    const { kept, duplicates } = collapse(parsed.punches);
    const ids = [...new Set(kept.map((p) => p.userId))];
    const [members, staff] = await Promise.all([
      Member.find({ subscriberId, deviceUserId: { $in: ids } }).select('deviceUserId'),
      SubAdmin.find({ subscriberId, deviceUserId: { $in: ids } }).select('deviceUserId'),
    ]);
    const memberBy = new Map(members.map((m) => [m.deviceUserId, m._id]));
    const staffBy = new Map(staff.map((s) => [s.deviceUserId, s._id]));

    const unmatched = new Map();
    const memberPunches = [];
    const staffPunches = [];
    for (const p of kept) {
      if (memberBy.has(p.userId)) memberPunches.push({ ...p, memberId: memberBy.get(p.userId) });
      else if (staffBy.has(p.userId)) staffPunches.push({ ...p, staffId: staffBy.get(p.userId) });
      else unmatched.set(p.userId, (unmatched.get(p.userId) || 0) + 1);
    }

    // Skip member punches already recorded (within 30 min of an existing check-in).
    let alreadyRecorded = 0;
    const toInsert = [];
    if (memberPunches.length) {
      const times = memberPunches.map((p) => p.at.getTime());
      const existing = await Attendance.find({
        subscriberId, memberId: { $in: [...new Set(memberPunches.map((p) => String(p.memberId)))] },
        checkedInAt: { $gte: new Date(Math.min(...times) - DEDUPE_MS), $lte: new Date(Math.max(...times) + DEDUPE_MS) },
      }).select('memberId checkedInAt');
      const byMember = new Map();
      for (const e of existing) {
        const k = String(e.memberId);
        if (!byMember.has(k)) byMember.set(k, []);
        byMember.get(k).push(e.checkedInAt.getTime());
      }
      for (const p of memberPunches) {
        const near = (byMember.get(String(p.memberId)) || []).some((t) => Math.abs(t - p.at.getTime()) < DEDUPE_MS);
        if (near) alreadyRecorded++;
        else toInsert.push({ subscriberId, memberId: p.memberId, checkedInAt: p.at, method: 'biometric', sessionType: 'general' });
      }
    }

    // Staff: first punch of the day = in, last = out (if 30+ minutes later).
    const staffDays = new Map();
    for (const p of staffPunches) {
      const key = `${p.staffId}|${localDate(p.at, tz)}`;
      const d = staffDays.get(key) || { staffId: p.staffId, date: localDate(p.at, tz), times: [] };
      d.times.push(p.at);
      staffDays.set(key, d);
    }

    const summary = {
      punchesRead: parsed.punches.length,
      rowProblems: parsed.errors.length,
      problemRows: parsed.errors.slice(0, 50),
      repeatPunches: duplicates,
      memberCheckIns: toInsert.length,
      alreadyRecorded,
      staffDays: staffDays.size,
      unmatchedIds: [...unmatched.entries()].slice(0, 50).map(([userId, punches]) => ({ userId, punches })),
      unmatchedCount: unmatched.size,
    };
    if (!commit) return res.json({ success: true, data: { ...summary, committed: false } });

    if (toInsert.length) await Attendance.insertMany(toInsert, { ordered: false });
    for (const d of staffDays.values()) {
      d.times.sort((a, b) => a - b);
      const inAt = d.times[0];
      const last = d.times[d.times.length - 1];
      const outAt = last - inAt >= DEDUPE_MS ? last : undefined;
      // $setOnInsert keeps a manual entry (e.g. leave) the owner already made for that day.
      await StaffAttendance.updateOne(
        { subscriberId, staffId: d.staffId, date: d.date },
        { $setOnInsert: { status: 'present', inAt, outAt, method: 'biometric' } },
        { upsert: true }
      );
    }
    await logAudit({ subscriberId, actingRole: 'admin', actingUserId: req.user.id, module: 'attendance', action: `device_log_import:${toInsert.length}+${staffDays.size}` });
    res.status(201).json({ success: true, data: { ...summary, committed: true } });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

module.exports = { importDeviceLog };
