const bcrypt = require('bcryptjs');
const Subscriber = require('../../models/Subscriber');
const Admin = require('../../models/Admin');
const SubAdmin = require('../../models/SubAdmin');

const GYM_FIELDS = ['gymName', 'logoUrl', 'brandColor', 'workingHours', 'holidays', 'memberIdFormat', 'staffIdFormat', 'attendanceGraceMode', 'aiPlanReviewRequired', 'gstEnabled', 'gstNumber', 'gstRate', 'whatsappEnabled', 'whatsappNumber'];

// ===== Gym Owner: gym-wide settings =====

// @desc    Gym profile/branding/hours/holidays/ID formats + the owner's own contact info
// @route   GET /api/admin/settings
const getGymSettings = async (req, res) => {
  try {
    const [subscriber, admin] = await Promise.all([
      Subscriber.findById(req.user.subscriberId),
      Admin.findById(req.user.id).select('name email phone'),
    ]);
    if (!subscriber) return res.status(404).json({ success: false, message: 'Gym not found' });

    res.status(200).json({
      success: true,
      message: 'Settings fetched successfully',
      data: { gym: subscriber, profile: admin },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Update gym profile/branding/hours/holidays/ID formats
// @route   PUT /api/admin/settings/gym
const updateGymSettings = async (req, res) => {
  try {
    const subscriber = await Subscriber.findById(req.user.subscriberId);
    if (!subscriber) return res.status(404).json({ success: false, message: 'Gym not found' });

    for (const field of GYM_FIELDS) {
      if (req.body[field] !== undefined) subscriber[field] = req.body[field];
    }
    await subscriber.save();

    res.status(200).json({ success: true, message: 'Gym settings updated successfully', data: subscriber });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Update the Gym Owner's own contact info
// @route   PUT /api/admin/settings/profile
const updateAdminProfile = async (req, res) => {
  try {
    const admin = await Admin.findById(req.user.id);
    if (!admin) return res.status(404).json({ success: false, message: 'Account not found' });

    const { name, email, phone } = req.body;
    if (name !== undefined) admin.name = name;
    if (email !== undefined) admin.email = email;
    if (phone !== undefined) admin.phone = phone;
    await admin.save();

    res.status(200).json({ success: true, message: 'Profile updated successfully', data: { name: admin.name, email: admin.email, phone: admin.phone } });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ===== Sub-Admin: own profile only (doc: "Own contact info, password, availability") =====

// @desc    The logged-in sub-admin's own profile
// @route   GET /api/subadmin/settings
const getMyProfile = async (req, res) => {
  try {
    const subAdmin = await SubAdmin.findById(req.user.id).select('name email phone template specialization availability notificationPreferences');
    if (!subAdmin) return res.status(404).json({ success: false, message: 'Account not found' });
    res.status(200).json({ success: true, message: 'Profile fetched successfully', data: subAdmin });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Update the logged-in sub-admin's own contact info / availability / password
// @route   PUT /api/subadmin/settings/profile
const updateMyProfile = async (req, res) => {
  try {
    const subAdmin = await SubAdmin.findById(req.user.id);
    if (!subAdmin) return res.status(404).json({ success: false, message: 'Account not found' });

    const { name, email, phone, availability, notificationPreferences, currentPassword, newPassword } = req.body;
    if (name !== undefined) subAdmin.name = name;
    if (email !== undefined) subAdmin.email = email;
    if (phone !== undefined) subAdmin.phone = phone;
    if (availability !== undefined) subAdmin.availability = availability;
    if (notificationPreferences !== undefined) {
      subAdmin.notificationPreferences = { ...subAdmin.notificationPreferences, ...notificationPreferences };
    }

    if (newPassword) {
      if (!currentPassword || !subAdmin.passwordHash || !(await bcrypt.compare(currentPassword, subAdmin.passwordHash))) {
        return res.status(401).json({ success: false, message: 'Current password is incorrect' });
      }
      if (newPassword.length < 6) {
        return res.status(400).json({ success: false, message: 'New password must be at least 6 characters' });
      }
      subAdmin.passwordHash = await bcrypt.hash(newPassword, 10);
    }

    await subAdmin.save();
    res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      data: { name: subAdmin.name, email: subAdmin.email, phone: subAdmin.phone, availability: subAdmin.availability, notificationPreferences: subAdmin.notificationPreferences },
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ success: false, message: 'That phone or email is already in use for this gym' });
    }
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

module.exports = { getGymSettings, updateGymSettings, updateAdminProfile, getMyProfile, updateMyProfile };
