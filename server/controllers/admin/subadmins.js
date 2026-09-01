const bcrypt = require('bcryptjs');
const SubAdmin = require('../../models/SubAdmin');
const Admin = require('../../models/Admin');
const AuditLog = require('../../models/AuditLog');
const { logAudit } = require('../../utils/auditLog');

// Mirrors client/src/config/navigation.js SUBADMIN_NAV — kept in sync manually
// since the client and server are separate apps with no shared package.
const ALLOWED_MODULES = [
  'dashboard', 'members', 'attendance', 'payment', 'earnings',
  'pt-sessions', 'workout', 'ai-plans', 'payment-history', 'settings',
];
const ALWAYS_ON_MODULES = ['dashboard', 'settings'];
const TEMPLATES = ['trainer', 'frontdesk', 'accountant', 'custom'];

// Normalizes/validates a client-submitted permissions object into the shape
// the SubAdmin model expects, enforcing server-side (not just UI) that
// dashboard/settings always carry at least view, and edit implies view.
const sanitizePermissions = (input = {}) => {
  const clean = {};
  for (const key of ALLOWED_MODULES) {
    const entry = input[key];
    const locked = ALWAYS_ON_MODULES.includes(key);
    const view = locked ? true : Boolean(entry?.view);
    const edit = Boolean(entry?.edit) && view;
    const viewAll = Boolean(entry?.viewAll) && view;
    if (view || edit) clean[key] = { view, edit, viewAll };
  }
  return clean;
};

const toSafeSubAdmin = (subAdmin) => {
  const obj = subAdmin.toObject ? subAdmin.toObject() : subAdmin;
  delete obj.passwordHash;
  delete obj.otpCode;
  delete obj.otpExpiresAt;
  return { ...obj, permissions: Object.fromEntries(subAdmin.permissions || []) };
};

// @desc    List all staff for this gym
// @route   GET /api/admin/subadmins
const listSubAdmins = async (req, res) => {
  try {
    const staff = await SubAdmin.find({ subscriberId: req.user.subscriberId }).sort({ name: 1 });
    res.status(200).json({ success: true, message: 'Staff fetched successfully', data: staff.map(toSafeSubAdmin) });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Create a staff login with a permission set
// @route   POST /api/admin/subadmins
const createSubAdmin = async (req, res) => {
  try {
    const { name, phone, email, password, template, permissions } = req.body;

    if (!name || !password || (!phone && !email)) {
      return res.status(400).json({ success: false, message: 'Name, password, and a phone or email are required' });
    }
    if (password.length < 6) {
      return res.status(400).json({ success: false, message: 'Password must be at least 6 characters' });
    }
    if (template && !TEMPLATES.includes(template)) {
      return res.status(400).json({ success: false, message: 'Invalid template' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const subAdmin = await SubAdmin.create({
      subscriberId: req.user.subscriberId,
      name,
      phone,
      email,
      passwordHash,
      template: template || 'custom',
      permissions: sanitizePermissions(permissions),
    });

    await logAudit({
      subscriberId: req.user.subscriberId,
      actingRole: req.user.role,
      actingUserId: req.user.id,
      module: 'staff',
      action: 'create_subadmin',
      targetId: subAdmin._id,
    });

    // TODO(task 15 — Notifications): send a set-password invite email instead
    // of the Gym Owner having to set/share this password directly.
    res.status(201).json({ success: true, message: 'Staff member created successfully', data: toSafeSubAdmin(subAdmin) });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ success: false, message: 'That phone or email is already in use for this gym' });
    }
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Update a staff member's profile, permissions, or (optionally) password
// @route   PUT /api/admin/subadmins/:id
const updateSubAdmin = async (req, res) => {
  try {
    const subAdmin = await SubAdmin.findOne({ _id: req.params.id, subscriberId: req.user.subscriberId });
    if (!subAdmin) {
      return res.status(404).json({ success: false, message: 'Staff member not found' });
    }

    const { name, phone, email, password, template, permissions } = req.body;
    if (name !== undefined) subAdmin.name = name;
    if (phone !== undefined) subAdmin.phone = phone;
    if (email !== undefined) subAdmin.email = email;
    if (template !== undefined) {
      if (!TEMPLATES.includes(template)) {
        return res.status(400).json({ success: false, message: 'Invalid template' });
      }
      subAdmin.template = template;
    }
    if (permissions !== undefined) subAdmin.permissions = sanitizePermissions(permissions);
    if (password) {
      if (password.length < 6) {
        return res.status(400).json({ success: false, message: 'Password must be at least 6 characters' });
      }
      subAdmin.passwordHash = await bcrypt.hash(password, 10);
    }

    await subAdmin.save();

    await logAudit({
      subscriberId: req.user.subscriberId,
      actingRole: req.user.role,
      actingUserId: req.user.id,
      module: 'staff',
      action: 'update_subadmin',
      targetId: subAdmin._id,
    });

    res.status(200).json({ success: true, message: 'Staff member updated successfully', data: toSafeSubAdmin(subAdmin) });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ success: false, message: 'That phone or email is already in use for this gym' });
    }
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Deactivate/reactivate a staff login instantly (keeps their history)
// @route   PATCH /api/admin/subadmins/:id/toggle
const toggleSubAdmin = async (req, res) => {
  try {
    const subAdmin = await SubAdmin.findOne({ _id: req.params.id, subscriberId: req.user.subscriberId });
    if (!subAdmin) {
      return res.status(404).json({ success: false, message: 'Staff member not found' });
    }

    subAdmin.isActive = !subAdmin.isActive;
    await subAdmin.save();

    await logAudit({
      subscriberId: req.user.subscriberId,
      actingRole: req.user.role,
      actingUserId: req.user.id,
      module: 'staff',
      action: subAdmin.isActive ? 'activate_subadmin' : 'deactivate_subadmin',
      targetId: subAdmin._id,
    });

    res.status(200).json({ success: true, message: `Staff member ${subAdmin.isActive ? 'reactivated' : 'deactivated'}`, data: toSafeSubAdmin(subAdmin) });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Recent audit log entries for this gym (who did what)
// @route   GET /api/admin/subadmins/audit-log
const getAuditLog = async (req, res) => {
  try {
    const { module, limit = 50 } = req.query;
    const query = { subscriberId: req.user.subscriberId };
    if (module) query.module = module;

    const entries = await AuditLog.find(query).sort({ timestamp: -1 }).limit(Math.min(200, Number(limit) || 50));

    const adminIds = entries.filter((e) => e.actingRole === 'admin').map((e) => e.actingUserId);
    const subAdminIds = entries.filter((e) => e.actingRole === 'subadmin').map((e) => e.actingUserId);
    const [admins, subAdmins] = await Promise.all([
      Admin.find({ _id: { $in: adminIds } }).select('name'),
      SubAdmin.find({ _id: { $in: subAdminIds } }).select('name'),
    ]);
    const nameById = new Map([...admins, ...subAdmins].map((u) => [String(u._id), u.name]));

    const withNames = entries.map((e) => ({ ...e.toObject(), actingUserName: nameById.get(String(e.actingUserId)) || 'Unknown' }));
    res.status(200).json({ success: true, message: 'Audit log fetched successfully', data: withNames });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

module.exports = { listSubAdmins, createSubAdmin, updateSubAdmin, toggleSubAdmin, getAuditLog };
