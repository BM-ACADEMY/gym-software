const PTSession = require('../../models/PTSession');
const Member = require('../../models/Member');

// Doc: "cancel/reschedule within policy window" — sessions can't be
// cancelled/rescheduled within this many hours of their start time.
const POLICY_WINDOW_HOURS = 2;

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

const withinPolicyWindow = (session) => session.scheduledAt.getTime() - Date.now() < POLICY_WINDOW_HOURS * 60 * 60 * 1000;

// @desc    Cancel a session (must be outside the policy window)
// @route   PATCH /api/member/pt-sessions/:id/cancel
const cancelSession = async (req, res) => {
  try {
    const session = await PTSession.findOne({ _id: req.params.id, memberId: req.user.id });
    if (!session) return res.status(404).json({ success: false, message: 'Session not found' });
    if (session.status !== 'scheduled') return res.status(400).json({ success: false, message: `This session is already ${session.status}` });
    if (withinPolicyWindow(session)) {
      return res.status(400).json({ success: false, message: `Sessions can only be cancelled more than ${POLICY_WINDOW_HOURS} hours in advance` });
    }
    session.status = 'cancelled';
    await session.save();
    res.status(200).json({ success: true, message: 'Session cancelled', data: session });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Reschedule a session (must be outside the policy window)
// @route   PUT /api/member/pt-sessions/:id/reschedule
const rescheduleSession = async (req, res) => {
  try {
    const { scheduledAt } = req.body;
    if (!scheduledAt) return res.status(400).json({ success: false, message: 'scheduledAt is required' });

    const session = await PTSession.findOne({ _id: req.params.id, memberId: req.user.id });
    if (!session) return res.status(404).json({ success: false, message: 'Session not found' });
    if (session.status !== 'scheduled') return res.status(400).json({ success: false, message: `This session is already ${session.status}` });
    if (withinPolicyWindow(session)) {
      return res.status(400).json({ success: false, message: `Sessions can only be rescheduled more than ${POLICY_WINDOW_HOURS} hours in advance` });
    }

    const clash = await PTSession.findOne({
      _id: { $ne: session._id }, subscriberId: req.user.subscriberId, subAdminId: session.subAdminId, scheduledAt: new Date(scheduledAt), status: 'scheduled',
    });
    if (clash) return res.status(400).json({ success: false, message: 'Your trainer already has a session booked at that time' });

    session.scheduledAt = new Date(scheduledAt);
    await session.save();
    res.status(200).json({ success: true, message: 'Session rescheduled', data: session });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

module.exports = { listMySessions, requestSession, cancelSession, rescheduleSession };
