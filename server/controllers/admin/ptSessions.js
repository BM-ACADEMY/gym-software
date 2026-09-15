const crypto = require('crypto');
const PTSession = require('../../models/PTSession');
const Member = require('../../models/Member');
const SubAdmin = require('../../models/SubAdmin');
const Attendance = require('../../models/Attendance');
const PTPackage = require('../../models/PTPackage');
const PTPackagePurchase = require('../../models/PTPackagePurchase');
const Payment = require('../../models/Payment');
const { predictNoShowRisk, suggestOptimalSlots } = require('../../services/ai');

const generateInvoiceNumber = () =>
  `INV-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;

const getModulePermission = (subAdmin, moduleKey) =>
  subAdmin?.permissions?.get?.(moduleKey) || subAdmin?.permissions?.[moduleKey];

// Unlike Members/Attendance/Payment (member-owned data), a PT session is
// trainer-owned — "own" here means subAdminId === the logged-in trainer,
// not "assigned to me."
const getSubAdminScope = (req) => {
  if (req.user.role !== 'subadmin') return { scoped: false };
  const perm = getModulePermission(req.subAdmin, 'pt-sessions');
  return { scoped: !perm?.viewAll, subAdminId: req.user.id };
};

const dayBoundsFromQuery = (query) => {
  const { dateFrom, dateTo } = query;
  const start = dateFrom ? new Date(dateFrom) : undefined;
  let end;
  if (dateTo) {
    end = new Date(dateTo);
    end.setHours(23, 59, 59, 999);
  }
  return { start, end };
};

// @desc    Book a PT session
// @route   POST /api/admin/pt-sessions  |  POST /api/subadmin/pt-sessions (edit)
const bookSession = async (req, res) => {
  try {
    const { memberId, subAdminId, scheduledAt, packagePurchaseId } = req.body;
    if (!memberId || !subAdminId || !scheduledAt) {
      return res.status(400).json({ success: false, message: 'memberId, subAdminId (trainer), and scheduledAt are required' });
    }

    const { scoped, subAdminId: ownTrainerId } = getSubAdminScope(req);
    if (scoped && String(subAdminId) !== String(ownTrainerId)) {
      return res.status(403).json({ success: false, message: 'You can only book sessions on your own calendar' });
    }

    const [member, trainer] = await Promise.all([
      Member.findOne({ _id: memberId, subscriberId: req.user.subscriberId }),
      SubAdmin.findOne({ _id: subAdminId, subscriberId: req.user.subscriberId, template: 'trainer' }),
    ]);
    if (!member) return res.status(404).json({ success: false, message: 'Member not found' });
    if (!trainer) return res.status(404).json({ success: false, message: 'Trainer not found' });

    // A package credit is optional — without one, this session is billed
    // individually the normal way (via the Payment module).
    let packagePurchase;
    if (packagePurchaseId) {
      packagePurchase = await PTPackagePurchase.findOne({ _id: packagePurchaseId, subscriberId: req.user.subscriberId, memberId });
      if (!packagePurchase) return res.status(404).json({ success: false, message: 'Package purchase not found for this member' });
      if (packagePurchase.sessionsUsed >= packagePurchase.sessionsTotal) {
        return res.status(400).json({ success: false, message: 'This package has no sessions remaining' });
      }
    }

    const clash = await PTSession.findOne({ subscriberId: req.user.subscriberId, subAdminId, scheduledAt: new Date(scheduledAt), status: 'scheduled' });
    if (clash) {
      return res.status(400).json({ success: false, message: 'This trainer already has a session booked at that time' });
    }

    // AI: flag the booking if this member has historically no-showed often —
    // needs a minimum history, so a first-time booker is never flagged.
    const pastSessions = await PTSession.find({ subscriberId: req.user.subscriberId, memberId }).select('status');
    const { predicted } = predictNoShowRisk(pastSessions.map((s) => s.status));

    const session = await PTSession.create({
      subscriberId: req.user.subscriberId,
      memberId,
      subAdminId,
      scheduledAt: new Date(scheduledAt),
      noShowPredicted: predicted,
      packagePurchaseId: packagePurchase?._id,
    });

    if (packagePurchase) {
      packagePurchase.sessionsUsed += 1;
      await packagePurchase.save();
    }

    res.status(201).json({ success: true, message: 'PT session booked successfully', data: session });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    List/calendar view of PT sessions, filterable
// @route   GET /api/admin/pt-sessions  |  GET /api/subadmin/pt-sessions (view)
const listSessions = async (req, res) => {
  try {
    const { memberId, subAdminId, status } = req.query;
    const query = { subscriberId: req.user.subscriberId };
    if (memberId) query.memberId = memberId;
    if (status) query.status = status;

    const { scoped, subAdminId: ownTrainerId } = getSubAdminScope(req);
    if (scoped) {
      query.subAdminId = ownTrainerId;
    } else if (subAdminId) {
      query.subAdminId = subAdminId;
    }

    const { start, end } = dayBoundsFromQuery(req.query);
    if (start || end) {
      query.scheduledAt = {};
      if (start) query.scheduledAt.$gte = start;
      if (end) query.scheduledAt.$lte = end;
    }

    const sessions = await PTSession.find(query)
      .populate('memberId', 'name phone')
      .populate('subAdminId', 'name')
      .sort({ scheduledAt: 1 });

    res.status(200).json({ success: true, message: 'PT sessions fetched successfully', data: sessions });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// Shared ownership + "must still be scheduled" guard for reschedule/cancel/complete/no-show.
const findEditableSession = async (req, res, { requireScheduled = true } = {}) => {
  const session = await PTSession.findOne({ _id: req.params.id, subscriberId: req.user.subscriberId });
  if (!session) {
    res.status(404).json({ success: false, message: 'PT session not found' });
    return null;
  }
  const { scoped, subAdminId } = getSubAdminScope(req);
  if (scoped && String(session.subAdminId) !== String(subAdminId)) {
    res.status(403).json({ success: false, message: 'This session is not on your calendar' });
    return null;
  }
  if (requireScheduled && session.status !== 'scheduled') {
    res.status(400).json({ success: false, message: `This session is already ${session.status}` });
    return null;
  }
  return session;
};

// @desc    Reschedule a session
// @route   PUT /api/admin/pt-sessions/:id/reschedule  |  PUT /api/subadmin/pt-sessions/:id/reschedule (edit)
const rescheduleSession = async (req, res) => {
  try {
    const { scheduledAt } = req.body;
    if (!scheduledAt) {
      return res.status(400).json({ success: false, message: 'scheduledAt is required' });
    }
    const session = await findEditableSession(req, res);
    if (!session) return;

    const clash = await PTSession.findOne({
      _id: { $ne: session._id },
      subscriberId: req.user.subscriberId,
      subAdminId: session.subAdminId,
      scheduledAt: new Date(scheduledAt),
      status: 'scheduled',
    });
    if (clash) {
      return res.status(400).json({ success: false, message: 'This trainer already has a session booked at that time' });
    }

    session.scheduledAt = new Date(scheduledAt);
    await session.save();
    res.status(200).json({ success: true, message: 'Session rescheduled successfully', data: session });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Cancel a session
// @route   PATCH /api/admin/pt-sessions/:id/cancel  |  PATCH /api/subadmin/pt-sessions/:id/cancel (edit)
const cancelSession = async (req, res) => {
  try {
    const session = await findEditableSession(req, res);
    if (!session) return;
    session.status = 'cancelled';
    await session.save();

    if (session.packagePurchaseId) {
      await PTPackagePurchase.findByIdAndUpdate(session.packagePurchaseId, { $inc: { sessionsUsed: -1 } });
    }

    res.status(200).json({ success: true, message: 'Session cancelled', data: session });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Manually mark a session completed (independent of the Attendance check-in flow)
// @route   PATCH /api/admin/pt-sessions/:id/complete  |  PATCH /api/subadmin/pt-sessions/:id/complete (edit)
const completeSession = async (req, res) => {
  try {
    const session = await findEditableSession(req, res);
    if (!session) return;
    session.status = 'completed';
    await session.save();
    res.status(200).json({ success: true, message: 'Session marked completed', data: session });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Mark a session a no-show (only once its scheduled time has passed)
// @route   PATCH /api/admin/pt-sessions/:id/no-show  |  PATCH /api/subadmin/pt-sessions/:id/no-show (edit)
const noShowSession = async (req, res) => {
  try {
    const session = await findEditableSession(req, res);
    if (!session) return;
    if (session.scheduledAt > new Date()) {
      return res.status(400).json({ success: false, message: 'Cannot mark a future session as a no-show yet' });
    }
    session.status = 'no_show';
    await session.save();
    res.status(200).json({ success: true, message: 'Session marked as no-show', data: session });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    AI-ranked slot suggestions — the trainer's open times matched
//          against this member's usual gym-visit hours
// @route   GET /api/admin/pt-sessions/suggest-slots?memberId=&subAdminId=
const suggestSlots = async (req, res) => {
  try {
    const { memberId, subAdminId } = req.query;
    if (!memberId || !subAdminId) {
      return res.status(400).json({ success: false, message: 'memberId and subAdminId are required' });
    }

    const [bookedSessions, recentAttendance] = await Promise.all([
      PTSession.find({ subscriberId: req.user.subscriberId, subAdminId, status: 'scheduled', scheduledAt: { $gte: new Date() } }).select('scheduledAt'),
      Attendance.find({ subscriberId: req.user.subscriberId, memberId }).select('checkedInAt').sort({ checkedInAt: -1 }).limit(30),
    ]);

    const bookedSlotKeys = bookedSessions.map((s) => s.scheduledAt.toISOString().slice(0, 13));
    const memberUsualHours = recentAttendance.map((a) => a.checkedInAt.getHours());

    const suggestions = suggestOptimalSlots({ bookedSlotKeys, memberUsualHours });
    res.status(200).json({ success: true, message: 'Slot suggestions generated', data: suggestions });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Active PT packages available to sell (trainers need this too, but
//          package definition/pricing itself stays admin-only via /pt-packages)
// @route   GET /api/admin/pt-sessions/packages  |  GET /api/subadmin/pt-sessions/packages (view)
const listActivePackages = async (req, res) => {
  try {
    const packages = await PTPackage.find({ subscriberId: req.user.subscriberId, isActive: true }).sort({ price: 1 });
    res.status(200).json({ success: true, message: 'PT packages fetched successfully', data: packages });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Sell a PT session package to a member — records payment and creates
//          the session-credit ledger entry in one step
// @route   POST /api/admin/pt-sessions/sell-package  |  POST /api/subadmin/pt-sessions/sell-package (edit)
const sellPackage = async (req, res) => {
  try {
    const { memberId, packageId, method } = req.body;
    if (!memberId || !packageId) {
      return res.status(400).json({ success: false, message: 'memberId and packageId are required' });
    }

    const { scoped, subAdminId } = getSubAdminScope(req);
    const member = await Member.findOne({ _id: memberId, subscriberId: req.user.subscriberId });
    if (!member) return res.status(404).json({ success: false, message: 'Member not found' });
    if (scoped && String(member.assignedSubAdminId) !== String(subAdminId)) {
      return res.status(403).json({ success: false, message: 'This member is not assigned to you' });
    }

    const pkg = await PTPackage.findOne({ _id: packageId, subscriberId: req.user.subscriberId, isActive: true });
    if (!pkg) return res.status(404).json({ success: false, message: 'PT package not found' });

    const payment = await Payment.create({
      subscriberId: req.user.subscriberId,
      memberId,
      amount: pkg.price,
      amountPaid: pkg.price,
      installments: [{ amount: pkg.price, method: method || 'cash', note: `${pkg.name} (${pkg.sessionCount} sessions)` }],
      method: method || 'cash',
      category: 'pt_session',
      status: 'paid',
      invoiceNumber: generateInvoiceNumber(),
      paidAt: new Date(),
    });

    const purchase = await PTPackagePurchase.create({
      subscriberId: req.user.subscriberId,
      memberId,
      packageId: pkg._id,
      packageName: pkg.name,
      sessionsTotal: pkg.sessionCount,
      paymentId: payment._id,
    });

    res.status(201).json({ success: true, message: `${pkg.name} sold to ${member.name}`, data: { purchase, payment } });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    A member's PT package purchases and remaining session credits
// @route   GET /api/admin/pt-sessions/member-packages?memberId=  |  GET /api/subadmin/pt-sessions/member-packages (view)
const listMemberPackages = async (req, res) => {
  try {
    const { memberId } = req.query;
    if (!memberId) return res.status(400).json({ success: false, message: 'memberId is required' });

    const { scoped, subAdminId } = getSubAdminScope(req);
    if (scoped) {
      const member = await Member.findOne({ _id: memberId, subscriberId: req.user.subscriberId });
      if (!member || String(member.assignedSubAdminId) !== String(subAdminId)) {
        return res.status(403).json({ success: false, message: 'This member is not assigned to you' });
      }
    }

    const purchases = await PTPackagePurchase.find({ subscriberId: req.user.subscriberId, memberId }).sort({ createdAt: -1 });
    const data = purchases.map((p) => ({ ...p.toObject(), sessionsRemaining: Math.max(0, p.sessionsTotal - p.sessionsUsed) }));
    res.status(200).json({ success: true, message: 'Member packages fetched successfully', data });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

module.exports = { bookSession, listSessions, rescheduleSession, cancelSession, completeSession, noShowSession, suggestSlots, listActivePackages, sellPackage, listMemberPackages };
