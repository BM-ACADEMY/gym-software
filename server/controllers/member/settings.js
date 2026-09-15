const bcrypt = require('bcryptjs');
const Member = require('../../models/Member');

// @desc    Own profile + notification preferences
// @route   GET /api/member/settings
const getMySettings = async (req, res) => {
  try {
    const member = await Member.findById(req.user.id).select('name email phone notificationPreferences');
    if (!member) return res.status(404).json({ success: false, message: 'Member not found' });
    res.status(200).json({ success: true, message: 'Settings fetched successfully', data: member });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Update profile, notification preferences, and/or password
//          (linked payment method is deferred to the payment-gateway task —
//          there's no tokenized card storage to link one to yet)
// @route   PUT /api/member/settings
const updateMySettings = async (req, res) => {
  try {
    const member = await Member.findById(req.user.id);
    if (!member) return res.status(404).json({ success: false, message: 'Member not found' });

    const { name, email, phone, notificationPreferences, currentPassword, newPassword } = req.body;
    if (name !== undefined) member.name = name;
    if (email !== undefined) member.email = email;
    if (phone !== undefined) member.phone = phone;
    if (notificationPreferences !== undefined) {
      member.notificationPreferences = { ...member.notificationPreferences, ...notificationPreferences };
    }

    if (newPassword) {
      if (!currentPassword || !member.passwordHash || !(await bcrypt.compare(currentPassword, member.passwordHash))) {
        return res.status(401).json({ success: false, message: 'Current password is incorrect' });
      }
      if (newPassword.length < 6) {
        return res.status(400).json({ success: false, message: 'New password must be at least 6 characters' });
      }
      member.passwordHash = await bcrypt.hash(newPassword, 10);
    }

    await member.save();
    res.status(200).json({
      success: true,
      message: 'Settings updated successfully',
      data: { name: member.name, email: member.email, phone: member.phone, notificationPreferences: member.notificationPreferences },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

module.exports = { getMySettings, updateMySettings };
