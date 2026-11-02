const bcrypt = require('bcryptjs');
const Subscriber = require('../../models/Subscriber');
const Admin = require('../../models/Admin');
const SubAdmin = require('../../models/SubAdmin');
const { effectivePlan } = require('../../services/subscription');

// Regional settings (global-ready). Pure so it can be unit tested.
const validateRegional = (body) => {
  const out = {};
  if (body.country !== undefined) {
    if (typeof body.country !== 'string' || !/^[A-Za-z]{2}$/.test(body.country)) return { error: 'Country must be a 2-letter code, for example IN' };
    out.country = body.country.toUpperCase();
  }
  if (body.currency !== undefined) {
    if (typeof body.currency !== 'string' || !/^[A-Za-z]{3}$/.test(body.currency)) return { error: 'Currency must be a 3-letter code, for example INR' };
    out.currency = body.currency.toUpperCase();
  }
  if (body.timezone !== undefined) {
    let ok = typeof body.timezone === 'string' && body.timezone.length < 64;
    if (ok) { try { new Intl.DateTimeFormat('en', { timeZone: body.timezone }); } catch { ok = false; } }
    if (!ok) return { error: 'That time zone is not recognised (example: Asia/Kolkata)' };
    out.timezone = body.timezone;
  }
  if (body.language !== undefined) {
    if (!['en', 'ta', 'hi'].includes(body.language)) return { error: 'Language must be en, ta or hi' };
    out.language = body.language;
  }
  return { value: out };
};

// Branding (logo, colour) is a Pro feature for gyms on the code-defined plans.
const validateBranding = (body) => {
  if (body.logoUrl !== undefined && body.logoUrl !== '' && !(typeof body.logoUrl === 'string' && /^https:\/\/\S{3,500}$/.test(body.logoUrl))) {
    return 'Logo must be a link starting with https://';
  }
  if (body.brandColor !== undefined && body.brandColor !== '' && !(typeof body.brandColor === 'string' && /^#[0-9A-Fa-f]{6}$/.test(body.brandColor))) {
    return 'Brand colour must look like #0d9488';
  }
  return null;
};

const GYM_FIELDS = ['gymName', 'logoUrl', 'brandColor', 'workingHours', 'holidays', 'memberIdFormat', 'staffIdFormat', 'attendanceGraceMode', 'aiPlanReviewRequired', 'gstEnabled', 'gstNumber', 'gstRate', 'whatsappEnabled', 'whatsappNumber', 'upiId', 'automations'];

// ===== Gym Owner: gym-wide settings =====

// @desc    Gym profile/branding/hours/holidays/ID formats + the owner's own contact info
// @route   GET /api/admin/settings
const getGymSettings = async (req, res) => {
  try {
    const [subscriber, admin] = await Promise.all([
      Subscriber.findById(req.user.subscriberId),
      Admin.findById(req.user.id).select('name email phone salesContactOk'),
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

    const regional = validateRegional(req.body);
    if (regional.error) return res.status(400).json({ success: false, message: regional.error });
    const brandingError = validateBranding(req.body);
    if (brandingError) return res.status(400).json({ success: false, message: brandingError });
    const changesBranding = (req.body.logoUrl !== undefined && (req.body.logoUrl || '') !== (subscriber.logoUrl || ''))
      || (req.body.brandColor !== undefined && (req.body.brandColor || '') !== (subscriber.brandColor || ''));
    if (changesBranding && !subscriber.platformPlanId) {
      const plan = effectivePlan(subscriber);
      if (plan && !plan.features.branding) {
        return res.status(403).json({ success: false, planUpgradeRequired: true, message: `Your plan (${plan.name}) doesn't include your own logo and colours. Upgrade to Pro to use them.` });
      }
    }
    Object.assign(subscriber, regional.value);

    // upiId and automations need checking; everything else is a plain whitelisted copy.
    if (req.body.upiId !== undefined) {
      const upi = typeof req.body.upiId === 'string' ? req.body.upiId.trim() : null;
      if (upi === null || (upi !== '' && !/^[\w.\-]{2,64}@[A-Za-z][A-Za-z0-9.\-]{1,30}$/.test(upi))) {
        return res.status(400).json({ success: false, message: 'That UPI ID does not look right (example: irongym@okaxis)' });
      }
    }
    if (req.body.automations !== undefined) {
      const a = req.body.automations;
      if (!a || typeof a !== 'object' || Array.isArray(a) || Object.values(a).some((v) => typeof v !== 'boolean')) {
        return res.status(400).json({ success: false, message: 'Invalid automation settings' });
      }
      subscriber.automations = {
        renewal: a.renewal !== false, dues: a.dues !== false, absence: a.absence !== false, dailySummary: a.dailySummary !== false,
      };
    }
    for (const field of GYM_FIELDS) {
      if (field === 'automations') continue;
      if (req.body[field] !== undefined) subscriber[field] = field === 'upiId' ? req.body.upiId.trim() : req.body[field];
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
    // "OK to call me": only a real true/false from the owner counts; anything else is ignored.
    // The time is stored so we can show when the permission was given or taken back.
    if (typeof req.body.salesContactOk === 'boolean' && req.body.salesContactOk !== !!admin.salesContactOk) {
      admin.salesContactOk = req.body.salesContactOk;
      admin.salesContactAt = new Date();
    }
    await admin.save();

    res.status(200).json({ success: true, message: 'Profile updated successfully', data: { name: admin.name, email: admin.email, phone: admin.phone, salesContactOk: !!admin.salesContactOk } });
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

module.exports = { validateRegional, validateBranding, getGymSettings, updateGymSettings, updateAdminProfile, getMyProfile, updateMyProfile };
