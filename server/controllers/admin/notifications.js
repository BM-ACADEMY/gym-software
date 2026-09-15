const Notification = require('../../models/Notification');
const Member = require('../../models/Member');
const SubAdmin = require('../../models/SubAdmin');
const { notifyMember, notifyStaff, runAllRules } = require('../../services/notifications');

// @desc    This gym's notification log
// @route   GET /api/admin/notifications
const listNotifications = async (req, res) => {
  try {
    const { recipientType, channel } = req.query;
    const query = { subscriberId: req.user.subscriberId };
    if (recipientType) query.recipientType = recipientType;
    if (channel) query.channel = channel;

    const notifications = await Notification.find(query).sort({ createdAt: -1 }).limit(200);
    res.status(200).json({ success: true, message: 'Notifications fetched successfully', data: notifications });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Broadcast an announcement to all/selected members and/or staff
// @route   POST /api/admin/notifications/broadcast
const broadcast = async (req, res) => {
  try {
    const { message, recipientType, recipientIds } = req.body;
    if (!message || !['members', 'staff', 'all'].includes(recipientType)) {
      return res.status(400).json({ success: false, message: 'message and a valid recipientType (members/staff/all) are required' });
    }

    let memberCount = 0;
    let staffCount = 0;

    if (recipientType === 'members' || recipientType === 'all') {
      const memberQuery = { subscriberId: req.user.subscriberId };
      if (Array.isArray(recipientIds) && recipientIds.length && recipientType === 'members') {
        memberQuery._id = { $in: recipientIds };
      }
      const members = await Member.find(memberQuery);
      await Promise.all(members.map((m) => notifyMember(m, 'announcement', message)));
      memberCount = members.length;
    }

    if (recipientType === 'staff' || recipientType === 'all') {
      const staffQuery = { subscriberId: req.user.subscriberId, isActive: true };
      if (Array.isArray(recipientIds) && recipientIds.length && recipientType === 'staff') {
        staffQuery._id = { $in: recipientIds };
      }
      const staff = await SubAdmin.find(staffQuery);
      await Promise.all(staff.map((s) => notifyStaff(s, 'announcement', message)));
      staffCount = staff.length;
    }

    res.status(200).json({
      success: true,
      message: `Sent to ${memberCount} member${memberCount === 1 ? '' : 's'} and ${staffCount} staff member${staffCount === 1 ? '' : 's'}`,
      data: { memberCount, staffCount },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Manually run the auto-notification rules now, for this gym only
// @route   POST /api/admin/notifications/run-rules
const runRulesNow = async (req, res) => {
  try {
    const result = await runAllRules(req.user.subscriberId);
    res.status(200).json({ success: true, message: 'Notification rules run successfully', data: result });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

module.exports = { listNotifications, broadcast, runRulesNow };
