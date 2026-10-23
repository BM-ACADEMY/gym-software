const Member = require('../../models/Member');
const PTSession = require('../../models/PTSession');
const Attendance = require('../../models/Attendance');
const Payment = require('../../models/Payment');
const { generateMemberQrDataUrl } = require('../../utils/qrcode');
const { computeStreak } = require('../../utils/streak');

// @desc    Plan status, next PT session, this week's streak, quick check-in QR
// @route   GET /api/member/dashboard
const getDashboard = async (req, res) => {
  try {
    const member = await Member.findById(req.user.id).populate('planId');
    if (!member) return res.status(404).json({ success: false, message: 'Member not found' });

    const now = new Date();
    const daysRemaining = member.expiresAt ? Math.max(0, Math.ceil((member.expiresAt - now) / (24 * 60 * 60 * 1000))) : null;

    const nextSession = await PTSession.findOne({ memberId: member._id, status: 'scheduled', scheduledAt: { $gte: now } })
      .sort({ scheduledAt: 1 })
      .populate('subAdminId', 'name');

    const recentAttendance = await Attendance.find({
      memberId: member._id,
      checkedInAt: { $gte: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000) },
    }).select('checkedInAt');
    const streak = computeStreak(recentAttendance.map((a) => a.checkedInAt));

    const qrCode = await generateMemberQrDataUrl(req.user.subscriberId, member._id);

    const nextPaymentDoc = await Payment.findOne({ memberId: member._id, status: { $in: ['pending', 'partial'] } })
      .sort({ dueDate: 1 });
    let nextPayment = null;
    if (nextPaymentDoc) {
      const isOverdue = nextPaymentDoc.dueDate && new Date(nextPaymentDoc.dueDate) < now;
      nextPayment = {
        _id: nextPaymentDoc._id,
        dueDate: nextPaymentDoc.dueDate,
        balanceDue: Math.max(0, nextPaymentDoc.amount - nextPaymentDoc.amountPaid),
        effectiveStatus: isOverdue ? 'overdue' : nextPaymentDoc.status,
      };
    }

    res.status(200).json({
      success: true,
      message: 'Dashboard fetched successfully',
      data: {
        planStatus: { status: member.status, planName: member.planId?.name, expiresAt: member.expiresAt, daysRemaining },
        nextSession,
        nextPayment,
        streak,
        qrCode,
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

module.exports = { getDashboard };
