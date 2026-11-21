const GymClass = require('../models/GymClass');
const ClassBooking = require('../models/ClassBooking');
const Member = require('../models/Member');
const Notification = require('../models/Notification');

const fail = (status, message, code) => Object.assign(new Error(message), { status, code });

// Bookings close when the class starts.
const assertOpen = (cls, now) => {
  if (!cls || cls.status !== 'scheduled') throw fail(404, 'Class not found');
  if (cls.startsAt <= now) throw fail(400, 'This class has already started.', 'class_started');
};

const assertMemberCanBook = (member, now) => {
  if (!member || member.status === 'cancelled') throw fail(404, 'Member not found');
  if (['frozen', 'expired'].includes(member.status) || (member.expiresAt && member.expiresAt < now)) {
    throw fail(403, 'Your membership is not active. Please renew to book classes.', 'membership_inactive');
  }
};

// Books the member if a seat is free, otherwise puts them on the waitlist.
// The seat is taken with one atomic update, so two people cannot take the last seat.
const book = async ({ subscriberId, classId, memberId }, now = new Date()) => {
  const cls = await GymClass.findOne({ _id: classId, subscriberId });
  assertOpen(cls, now);
  const member = await Member.findOne({ _id: memberId, subscriberId });
  assertMemberCanBook(member, now);

  const existing = await ClassBooking.findOne({ classId, memberId, status: { $in: ['booked', 'waitlist'] } });
  if (existing) throw fail(409, existing.status === 'booked' ? 'You are already booked.' : 'You are already on the waitlist.', 'already_booked');

  const seat = await GymClass.findOneAndUpdate(
    { _id: classId, subscriberId, status: 'scheduled', $expr: { $lt: ['$bookedCount', '$capacity'] } },
    { $inc: { bookedCount: 1 } },
    { new: true }
  );
  const status = seat ? 'booked' : 'waitlist';
  try {
    const booking = await ClassBooking.create({ subscriberId, classId, memberId, status });
    return booking;
  } catch (e) {
    if (seat) await GymClass.updateOne({ _id: classId }, { $inc: { bookedCount: -1 } });
    if (e.code === 11000) throw fail(409, 'You already have a place in this class.', 'already_booked');
    throw e;
  }
};

const notifyPromoted = async (cls, booking) => {
  try {
    await Notification.create({
      subscriberId: cls.subscriberId, recipientType: 'member', recipientId: booking.memberId,
      type: 'class_waitlist_promoted', channel: 'in_app', sentAt: new Date(),
      message: `A seat opened up. You are now booked for ${cls.name} on ${cls.startsAt.toISOString()}.`,
    });
  } catch (e) { console.error('promote notice failed', e.message); }
};

// Cancels a booking. If a confirmed seat is freed, the earliest waitlisted member gets it.
const cancel = async ({ subscriberId, bookingId, memberId }) => {
  const filter = { _id: bookingId, subscriberId, status: { $in: ['booked', 'waitlist'] } };
  if (memberId) filter.memberId = memberId;
  const was = await ClassBooking.findOneAndUpdate(filter, { $set: { status: 'cancelled', cancelledAt: new Date() } });
  if (!was) throw fail(404, 'Booking not found');
  if (was.status !== 'booked') return { cancelled: true, promoted: null };

  const cls = await GymClass.findOne({ _id: was.classId, subscriberId });
  // Hand the seat to the next person in line; only decrement if nobody is waiting.
  let promoted = null;
  while (cls && cls.status === 'scheduled') {
    const next = await ClassBooking.findOneAndUpdate(
      { classId: was.classId, subscriberId, status: 'waitlist' },
      { $set: { status: 'booked' } },
      { sort: { createdAt: 1 }, new: true }
    );
    if (!next) break;
    const m = await Member.findOne({ _id: next.memberId, subscriberId }).select('status expiresAt');
    if (m && m.status !== 'cancelled' && m.status !== 'frozen' && m.status !== 'expired' && !(m.expiresAt && m.expiresAt < new Date())) {
      promoted = next;
      await notifyPromoted(cls, next);
      break;
    }
    // Skip people whose membership lapsed while waiting.
    await ClassBooking.updateOne({ _id: next._id }, { $set: { status: 'cancelled', cancelledAt: new Date() } });
  }
  if (!promoted) await GymClass.updateOne({ _id: was.classId, subscriberId, bookedCount: { $gt: 0 } }, { $inc: { bookedCount: -1 } });
  return { cancelled: true, promoted };
};

// Cancelling a whole class releases everyone.
const cancelClass = async ({ subscriberId, classId }) => {
  const cls = await GymClass.findOneAndUpdate({ _id: classId, subscriberId, status: 'scheduled' }, { $set: { status: 'cancelled' } }, { new: true });
  if (!cls) throw fail(404, 'Class not found');
  const live = await ClassBooking.find({ classId, subscriberId, status: { $in: ['booked', 'waitlist'] } }).select('memberId');
  await ClassBooking.updateMany({ classId, subscriberId, status: { $in: ['booked', 'waitlist'] } }, { $set: { status: 'cancelled', cancelledAt: new Date() } });
  await Promise.all(live.map((b) => Notification.create({
    subscriberId, recipientType: 'member', recipientId: b.memberId, type: 'class_cancelled', channel: 'in_app', sentAt: new Date(),
    message: `${cls.name} on ${cls.startsAt.toISOString()} has been cancelled by the gym.`,
  }).catch(() => null)));
  return cls;
};

module.exports = { book, cancel, cancelClass };
