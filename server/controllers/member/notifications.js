const Notification = require('../../models/Notification');

// @desc    View own notifications
// @route   GET /api/member/notifications
const listMyNotifications = async (req, res) => {
  try {
    const notifications = await Notification.find({ recipientType: 'member', recipientId: req.user.id }).sort({ createdAt: -1 }).limit(100);
    res.status(200).json({ success: true, message: 'Notifications fetched successfully', data: notifications });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Mark one notification read
// @route   PATCH /api/member/notifications/:id/read
const markRead = async (req, res) => {
  try {
    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.id, recipientType: 'member', recipientId: req.user.id },
      { readAt: new Date() },
      { returnDocument: 'after' }
    );
    if (!notification) return res.status(404).json({ success: false, message: 'Notification not found' });
    res.status(200).json({ success: true, message: 'Marked as read', data: notification });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

module.exports = { listMyNotifications, markRead };
