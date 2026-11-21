const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../../middleware/auth');
const GymClass = require('../../models/GymClass');
const ClassBooking = require('../../models/ClassBooking');
const svc = require('../../services/classBooking');

router.use(protect, authorize('admin'));

const str = (v) => (typeof v === 'string' ? v : '');
const handle = (fn) => async (req, res) => {
  try {
    await fn(req, res);
  } catch (e) {
    if (!e.status && e.name !== 'ValidationError' && e.name !== 'CastError') console.error(e);
    const bad = e.name === 'ValidationError' || e.name === 'CastError';
    res.status(e.status || (bad ? 400 : 500)).json({ success: false, code: e.code, message: e.status ? e.message : bad ? 'Please check the details' : 'Server error' });
  }
};

// GET /api/admin/classes?from=ISO  (default: from now; includes past 0)
router.get('/', handle(async (req, res) => {
  const from = req.query.from ? new Date(str(req.query.from)) : new Date();
  const filter = { subscriberId: req.user.subscriberId, startsAt: { $gte: Number.isNaN(from.getTime()) ? new Date() : from } };
  const list = await GymClass.find(filter).sort({ startsAt: 1 }).limit(200).lean();
  const ids = list.map((c) => c._id);
  const waits = await ClassBooking.aggregate([
    { $match: { subscriberId: new (require('mongoose').Types.ObjectId)(req.user.subscriberId), classId: { $in: ids }, status: 'waitlist' } },
    { $group: { _id: '$classId', n: { $sum: 1 } } },
  ]);
  const wl = Object.fromEntries(waits.map((w) => [String(w._id), w.n]));
  res.json({ success: true, data: list.map((c) => ({ ...c, waitlistCount: wl[String(c._id)] || 0 })) });
}));

// POST /api/admin/classes  { name, trainerName?, startsAt, durationMin?, capacity }
router.post('/', handle(async (req, res) => {
  const startsAt = new Date(str(req.body.startsAt));
  if (Number.isNaN(startsAt.getTime()) || startsAt <= new Date()) {
    return res.status(400).json({ success: false, message: 'Choose a start time in the future' });
  }
  const cls = await GymClass.create({
    subscriberId: req.user.subscriberId,
    name: str(req.body.name).trim(),
    trainerName: str(req.body.trainerName).trim() || undefined,
    startsAt,
    durationMin: Number(req.body.durationMin) || 60,
    capacity: Number(req.body.capacity),
  });
  res.status(201).json({ success: true, data: cls });
}));

// GET /api/admin/classes/:id/bookings
router.get('/:id/bookings', handle(async (req, res) => {
  const cls = await GymClass.findOne({ _id: req.params.id, subscriberId: req.user.subscriberId });
  if (!cls) return res.status(404).json({ success: false, message: 'Class not found' });
  const bookings = await ClassBooking.find({ classId: cls._id, subscriberId: req.user.subscriberId, status: { $in: ['booked', 'waitlist'] } })
    .sort({ createdAt: 1 }).populate('memberId', 'name phone').lean();
  res.json({ success: true, data: { class: cls, bookings } });
}));

// POST /api/admin/classes/:id/bookings  { memberId }  (staff books for a member)
router.post('/:id/bookings', handle(async (req, res) => {
  const b = await svc.book({ subscriberId: req.user.subscriberId, classId: req.params.id, memberId: str(req.body.memberId) });
  res.status(201).json({ success: true, data: b });
}));

// DELETE /api/admin/classes/:id/bookings/:bookingId
router.delete('/:id/bookings/:bookingId', handle(async (req, res) => {
  const r = await svc.cancel({ subscriberId: req.user.subscriberId, bookingId: req.params.bookingId });
  res.json({ success: true, data: r });
}));

// PATCH /api/admin/classes/:id/cancel
router.patch('/:id/cancel', handle(async (req, res) => {
  const cls = await svc.cancelClass({ subscriberId: req.user.subscriberId, classId: req.params.id });
  res.json({ success: true, data: cls });
}));

module.exports = router;
