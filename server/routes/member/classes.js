const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../../middleware/auth');
const GymClass = require('../../models/GymClass');
const ClassBooking = require('../../models/ClassBooking');
const svc = require('../../services/classBooking');

router.use(protect, authorize('member'));

const handle = (fn) => async (req, res) => {
  try {
    await fn(req, res);
  } catch (e) {
    if (!e.status && e.name !== 'CastError') console.error(e);
    res.status(e.status || (e.name === 'CastError' ? 400 : 500)).json({ success: false, code: e.code, message: e.status ? e.message : 'Server error' });
  }
};

// GET /api/member/classes: upcoming classes in my gym with my own place in each
router.get('/', handle(async (req, res) => {
  const { subscriberId, id: memberId } = req.user;
  const list = await GymClass.find({ subscriberId, status: 'scheduled', startsAt: { $gt: new Date() } }).sort({ startsAt: 1 }).limit(100).lean();
  const mine = await ClassBooking.find({ subscriberId, memberId, classId: { $in: list.map((c) => c._id) }, status: { $in: ['booked', 'waitlist'] } }).lean();
  const byClass = Object.fromEntries(mine.map((b) => [String(b.classId), b]));
  res.json({
    success: true,
    data: list.map((c) => ({
      _id: c._id, name: c.name, trainerName: c.trainerName, startsAt: c.startsAt, durationMin: c.durationMin,
      capacity: c.capacity, seatsLeft: Math.max(0, c.capacity - c.bookedCount),
      myBooking: byClass[String(c._id)] ? { _id: byClass[String(c._id)]._id, status: byClass[String(c._id)].status } : null,
    })),
  });
}));

// POST /api/member/classes/:id/book
router.post('/:id/book', handle(async (req, res) => {
  const b = await svc.book({ subscriberId: req.user.subscriberId, classId: req.params.id, memberId: req.user.id });
  res.status(201).json({ success: true, data: { _id: b._id, status: b.status } });
}));

// DELETE /api/member/classes/bookings/:bookingId
router.delete('/bookings/:bookingId', handle(async (req, res) => {
  const r = await svc.cancel({ subscriberId: req.user.subscriberId, bookingId: req.params.bookingId, memberId: req.user.id });
  res.json({ success: true, data: { cancelled: r.cancelled } });
}));

module.exports = router;
