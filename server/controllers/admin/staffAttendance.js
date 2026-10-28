const SubAdmin = require('../../models/SubAdmin');
const StaffAttendance = require('../../models/StaffAttendance');
const Subscriber = require('../../models/Subscriber');
const { logAudit } = require('../../utils/auditLog');

const STATUSES = ['present', 'leave', 'absent'];
const isDate = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(new Date(`${s}T00:00:00Z`).getTime());

const gymToday = async (subscriberId) => {
  const sub = await Subscriber.findById(subscriberId).select('timezone');
  return new Intl.DateTimeFormat('en-CA', { timeZone: sub?.timezone || 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
};

// @desc    Everyone on staff with their attendance for one day
// @route   GET /api/admin/staff-attendance?date=YYYY-MM-DD
const listDay = async (req, res) => {
  try {
    const subscriberId = req.user.subscriberId;
    const date = req.query.date || (await gymToday(subscriberId));
    if (!isDate(date)) return res.status(400).json({ success: false, message: 'date must look like 2026-12-01' });
    const [staff, records] = await Promise.all([
      SubAdmin.find({ subscriberId, isActive: { $ne: false } }).select('name phone deviceUserId').sort({ name: 1 }),
      StaffAttendance.find({ subscriberId, date }),
    ]);
    const by = new Map(records.map((r) => [String(r.staffId), r]));
    res.json({
      success: true,
      data: { date, staff: staff.map((s) => ({ id: s._id, name: s.name, phone: s.phone, deviceUserId: s.deviceUserId || null, record: by.get(String(s._id)) || null })) },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Totals per staff member for a month
// @route   GET /api/admin/staff-attendance/month?month=YYYY-MM
const monthSummary = async (req, res) => {
  try {
    const subscriberId = req.user.subscriberId;
    const month = req.query.month || (await gymToday(subscriberId)).slice(0, 7);
    if (!/^\d{4}-\d{2}$/.test(month)) return res.status(400).json({ success: false, message: 'month must look like 2026-12' });
    const [staff, records] = await Promise.all([
      SubAdmin.find({ subscriberId, isActive: { $ne: false } }).select('name').sort({ name: 1 }),
      StaffAttendance.find({ subscriberId, date: { $gte: `${month}-01`, $lte: `${month}-31` } }),
    ]);
    const rows = staff.map((s) => {
      const mine = records.filter((r) => String(r.staffId) === String(s._id));
      return { id: s._id, name: s.name, present: mine.filter((r) => r.status === 'present').length, leave: mine.filter((r) => r.status === 'leave').length, absent: mine.filter((r) => r.status === 'absent').length };
    });
    res.json({ success: true, data: { month, rows } });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Mark one staff member for one day (replaces what was there)
// @route   PUT /api/admin/staff-attendance   { staffId, date, status, note? }
const mark = async (req, res) => {
  try {
    const subscriberId = req.user.subscriberId;
    const { staffId, date, status } = req.body;
    const note = typeof req.body.note === 'string' ? req.body.note.trim().slice(0, 200) : undefined;
    if (!isDate(date)) return res.status(400).json({ success: false, message: 'date must look like 2026-12-01' });
    if (!STATUSES.includes(status)) return res.status(400).json({ success: false, message: 'status must be present, leave or absent' });
    if (date > (await gymToday(subscriberId))) return res.status(400).json({ success: false, message: 'You cannot mark a future day' });
    const staff = typeof staffId === 'string' ? await SubAdmin.findOne({ _id: staffId, subscriberId }).select('_id').catch(() => null) : null;
    if (!staff) return res.status(404).json({ success: false, message: 'Staff member not found' });

    const record = await StaffAttendance.findOneAndUpdate(
      { subscriberId, staffId: staff._id, date },
      { $set: { status, method: 'manual', note }, ...(status === 'present' ? {} : { $unset: { inAt: '', outAt: '' } }) },
      { upsert: true, new: true }
    );
    await logAudit({ subscriberId, actingRole: 'admin', actingUserId: req.user.id, module: 'staff-attendance', action: `mark_${status}_${date}`, targetId: staff._id });
    res.json({ success: true, data: record });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

module.exports = { listDay, monthSummary, mark };
