const PTSession = require('../../models/PTSession');
const Member = require('../../models/Member');

// RM-10 (Kamarudeen, 25 Nov): a member may cancel or move a session any time
// until it starts, the same day included. The old rule was 2 hours before.

// @desc    View own PT sessions
// @route   GET /api/member/pt-sessions
const listMySessions = async (req, res) => {
  try {
    const sessions = await PTSession.find({ memberId: req.user.id }).populate('subAdminId', 'name').sort({ scheduledAt: -1 });
    res.status(200).json({ success: true, message: 'PT sessions fetched successfully', data: sessions });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Request a PT session slot with your assigned trainer
// @route   POST /api/member/pt-sessions
const requestSession = async (req, res) => {
  try {
    const { scheduledAt } = req.body;
    if (!scheduledAt) return res.status(400).json({ success: false, message: 'scheduledAt is required' });

    const member = await Member.findById(req.user.id);
    if (!member?.assignedSubAdminId) {
      return res.status(400).json({ success: false, message: 'You do not have an assigned trainer yet — contact your gym.' });
    }

    const clash = await PTSession.findOne({
      subscriberId: req.user.subscriberId, subAdminId: member.assignedSubAdminId, scheduledAt: new Date(scheduledAt), status: 'scheduled',
    });
    if (clash) return res.status(400).json({ success: false, message: 'Your trainer already has a session booked at that time' });

    const session = await PTSession.create({
      subscriberId: req.user.subscriberId, memberId: member._id, subAdminId: member.assignedSubAdminId, scheduledAt: new Date(scheduledAt),
    });
    res.status(201).json({ success: true, message: 'Session requested successfully', data: session });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const hasStarted = (session) => session.scheduledAt.getTime() <= Date.now();

// @desc    Cancel a session (any time before it starts)
// @route   PATCH /api/member/pt-sessions/:id/cancel
const cancelSession = async (req, res) => {
  try {
    const session = await PTSession.findOne({ _id: req.params.id, memberId: req.user.id });
    if (!session) return res.status(404).json({ success: false, message: 'Session not found' });
    if (session.status !== 'scheduled') return res.status(400).json({ success: false, message: `This session is already ${session.status}` });
    if (hasStarted(session)) {
      return res.status(400).json({ success: false, message: 'This session has already started, so it cannot be cancelled' });
    }
    session.status = 'cancelled';
    await session.save();
    res.status(200).json({ success: true, message: 'Session cancelled', data: session });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Reschedule a session (any time before it starts, to a time that has not passed)
// @route   PUT /api/member/pt-sessions/:id/reschedule
const rescheduleSession = async (req, res) => {
  try {
    const { scheduledAt } = req.body;
    if (!scheduledAt) return res.status(400).json({ success: false, message: 'scheduledAt is required' });
    const newTime = new Date(scheduledAt);
    if (Number.isNaN(newTime.getTime()) || newTime.getTime() <= Date.now()) {
      return res.status(400).json({ success: false, message: 'Pick a time that has not passed yet' });
    }

    const session = await PTSession.findOne({ _id: req.params.id, memberId: req.user.id });
    if (!session) return res.status(404).json({ success: false, message: 'Session not found' });
    if (session.status !== 'scheduled') return res.status(400).json({ success: false, message: `This session is already ${session.status}` });
    if (hasStarted(session)) {
      return res.status(400).json({ success: false, message: 'This session has already started, so it cannot be moved' });
    }

    const clash = await PTSession.findOne({
      _id: { $ne: session._id }, subscriberId: req.user.subscriberId, subAdminId: session.subAdminId, scheduledAt: newTime, status: 'scheduled',
    });
    if (clash) return res.status(400).json({ success: false, message: 'Your trainer already has a session booked at that time' });

    session.scheduledAt = newTime;
    await session.save();
    res.status(200).json({ success: true, message: 'Session rescheduled', data: session });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

module.exports = { listMySessions, requestSession, cancelSession, rescheduleSession };
