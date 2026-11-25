// RM-10 (D-32 rule 10, Kamarudeen 25 Nov): deleting a gym moves it to a bin for 30 days.
// While in the bin the gym is closed to its owner, staff and members, and the jobs skip it.
// Root Admin can restore it, or delete it for good; after 30 days it is deleted for good by itself.
const Subscriber = require('../models/Subscriber');
const AuditLog = require('../models/AuditLog');

const BIN_DAYS = 30;
const DAY = 24 * 60 * 60 * 1000;
const purgeDate = (deletedAt) => new Date(new Date(deletedAt).getTime() + BIN_DAYS * DAY);

// Everything that belongs to one gym. Not here on purpose: SubscriptionPayment (our GST invoices to the gym,
// kept for tax records) and AuditLog (the record that the gym existed and was deleted).
const GYM_DATA_MODELS = [
  'Admin', 'SubAdmin', 'Member', 'Payment', 'PTSession', 'Workout', 'WorkoutTemplate', 'Attendance', 'Expense',
  'Trial', 'Notification', 'Lead', 'OwnerReport', 'GymClass', 'ClassBooking', 'PayrollRun',
];

const moveToBin = async (subscriber, actorId, now = new Date()) => {
  subscriber.activeBeforeDelete = subscriber.isActive !== false;
  subscriber.isActive = false;
  subscriber.deletedAt = now;
  subscriber.deletedBy = actorId;
  await subscriber.save();
  return purgeDate(now);
};

const restoreFromBin = async (subscriber) => {
  subscriber.isActive = subscriber.activeBeforeDelete !== false;
  subscriber.deletedAt = null;
  subscriber.deletedBy = undefined;
  subscriber.activeBeforeDelete = undefined;
  await subscriber.save();
};

// Deletes the gym and all its data for good. actorId is the Root Admin who asked; for the automatic
// delete after 30 days it is the Root Admin who put the gym in the bin, and the action says so.
const purgeGym = async (subscriberId, actorId, action = 'delete') => {
  await Promise.all(GYM_DATA_MODELS.map((name) => require(`../models/${name}`).deleteMany({ subscriberId })));
  await Subscriber.deleteOne({ _id: subscriberId });
  await AuditLog.create({ subscriberId, actingRole: 'root_admin', actingUserId: actorId, module: 'subscribers', action, targetId: subscriberId });
};

// Run by the scheduler: deletes for good every gym that has been in the bin for 30 days.
const purgeExpired = async (now = new Date()) => {
  const due = await Subscriber.find({ deletedAt: { $ne: null, $lte: new Date(now.getTime() - BIN_DAYS * DAY) } }).select('_id deletedBy');
  for (const s of due) await purgeGym(s._id, s.deletedBy, 'delete_after_30_days');
  return due.length;
};

module.exports = { BIN_DAYS, purgeDate, moveToBin, restoreFromBin, purgeGym, purgeExpired, GYM_DATA_MODELS };
