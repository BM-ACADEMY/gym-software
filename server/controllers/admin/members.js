const Member = require('../../models/Member');
const GymPlan = require('../../models/GymPlan');
const SubAdmin = require('../../models/SubAdmin');
const { generateMemberQrDataUrl } = require('../../utils/qrcode');

const STATUS_VALUES = ['trial', 'active', 'expiring', 'expired', 'frozen', 'cancelled'];

// A sub-admin's `permissions` map is a Mongoose Map when hydrated from the DB
// (as it is on req.subAdmin, set by permissionGuard) — this normalizes both
// that and a plain object so callers don't need to know which they got.
const getModulePermission = (subAdmin, moduleKey) =>
  subAdmin?.permissions?.get?.(moduleKey) || subAdmin?.permissions?.[moduleKey];

// Resolves the data-boundary rule from the doc: a sub-admin only sees members
// assigned to them unless the Gym Owner granted "view all" on this module.
const getSubAdminScope = (req) => {
  if (req.user.role !== 'subadmin') return { scoped: false };
  const perm = getModulePermission(req.subAdmin, 'members');
  return { scoped: !perm?.viewAll, subAdminId: req.user.id };
};

// Translates the doc's display statuses (active/expiring/expired/frozen/...)
// into a Mongo filter, since "expiring"/"expired" are derived from expiresAt
// rather than always being the persisted `status` value.
const buildStatusFilter = (status) => {
  const now = new Date();
  const in7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  if (status === 'expiring') {
    return { status: 'active', expiresAt: { $gt: now, $lte: in7Days } };
  }
  if (status === 'expired') {
    return {
      $or: [
        { status: 'expired' },
        { status: 'active', expiresAt: { $lte: now } },
      ],
    };
  }
  if (status === 'active') {
    return {
      status: 'active',
      $or: [{ expiresAt: null }, { expiresAt: { $gt: in7Days } }],
    };
  }
  if (STATUS_VALUES.includes(status)) return { status };
  return {};
};

// Attaches a display-only effectiveStatus without mutating the stored status
// field — the stored value only changes via explicit actions (freeze/renew/cancel).
const withEffectiveStatus = (memberDoc) => {
  const member = memberDoc.toObject ? memberDoc.toObject() : memberDoc;
  const now = new Date();
  let effectiveStatus = member.status;
  if (member.status === 'active' && member.expiresAt) {
    const expiresAt = new Date(member.expiresAt);
    if (expiresAt <= now) effectiveStatus = 'expired';
    else if (expiresAt.getTime() - now.getTime() <= 7 * 24 * 60 * 60 * 1000) effectiveStatus = 'expiring';
  }
  return { ...member, effectiveStatus };
};

// @desc    List members (search/filter/paginate), scoped to the caller's gym
//          and — for a sub-admin without "view all" — to their own assigned members
// @route   GET /api/admin/members  |  GET /api/subadmin/members
const listMembers = async (req, res) => {
  try {
    const { status, search, page = 1, limit = 20 } = req.query;
    const query = { subscriberId: req.user.subscriberId };

    const { scoped, subAdminId } = getSubAdminScope(req);
    if (scoped) query.assignedSubAdminId = subAdminId;

    if (status) Object.assign(query, buildStatusFilter(status));
    if (search) {
      query.$and = (query.$and || []).concat({
        $or: [
          { name: { $regex: search, $options: 'i' } },
          { phone: { $regex: search, $options: 'i' } },
        ],
      });
    }

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));

    const [members, total] = await Promise.all([
      Member.find(query)
        .populate('planId', 'name price durationDays')
        .populate('assignedSubAdminId', 'name')
        .sort({ createdAt: -1 })
        .skip((pageNum - 1) * limitNum)
        .limit(limitNum),
      Member.countDocuments(query),
    ]);

    res.status(200).json({
      success: true,
      message: 'Members fetched successfully',
      data: {
        members: members.map(withEffectiveStatus),
        total,
        page: pageNum,
        limit: limitNum,
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Active gym plans for this subscriber, for the assign-plan dropdown
// @route   GET /api/admin/members/meta/plans  |  GET /api/subadmin/members/meta/plans
const listPlansLookup = async (req, res) => {
  try {
    const plans = await GymPlan.find({ subscriberId: req.user.subscriberId, isActive: true })
      .select('name price durationDays includedServices')
      .sort({ name: 1 });
    res.status(200).json({ success: true, message: 'Plans fetched successfully', data: plans });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Active staff for this subscriber, for the assign-trainer dropdown
// @route   GET /api/admin/members/meta/staff  |  GET /api/subadmin/members/meta/staff
const listStaffLookup = async (req, res) => {
  try {
    const staff = await SubAdmin.find({ subscriberId: req.user.subscriberId, isActive: true })
      .select('name template')
      .sort({ name: 1 });
    res.status(200).json({ success: true, message: 'Staff fetched successfully', data: staff });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Get one member, including their check-in QR code
// @route   GET /api/admin/members/:id  |  GET /api/subadmin/members/:id
const getMember = async (req, res) => {
  try {
    const { scoped, subAdminId } = getSubAdminScope(req);
    const query = { _id: req.params.id, subscriberId: req.user.subscriberId };
    if (scoped) query.assignedSubAdminId = subAdminId;

    const member = await Member.findOne(query)
      .populate('planId', 'name price durationDays')
      .populate('assignedSubAdminId', 'name');

    if (!member) {
      return res.status(404).json({ success: false, message: 'Member not found' });
    }

    const qrCode = await generateMemberQrDataUrl(req.user.subscriberId, member._id);

    res.status(200).json({
      success: true,
      message: 'Member fetched successfully',
      data: { ...withEffectiveStatus(member), qrCode },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// Validates that planId/assignedSubAdminId (if provided) belong to the caller's
// own gym, and computes expiresAt from the plan's duration when a plan is set.
const resolvePlanAndTrainer = async (req, body) => {
  const update = {};

  if (body.planId !== undefined) {
    if (body.planId === null || body.planId === '') {
      update.planId = null;
      update.expiresAt = null;
    } else {
      const plan = await GymPlan.findOne({ _id: body.planId, subscriberId: req.user.subscriberId });
      if (!plan) throw new Error('Selected plan was not found for this gym');
      update.planId = plan._id;
      update.expiresAt = new Date(Date.now() + plan.durationDays * 24 * 60 * 60 * 1000);
    }
  }

  if (body.assignedSubAdminId !== undefined) {
    if (body.assignedSubAdminId === null || body.assignedSubAdminId === '') {
      update.assignedSubAdminId = null;
    } else {
      const staff = await SubAdmin.findOne({ _id: body.assignedSubAdminId, subscriberId: req.user.subscriberId });
      if (!staff) throw new Error('Selected staff member was not found for this gym');
      update.assignedSubAdminId = staff._id;
    }
  }

  return update;
};

// @desc    Create a member
// @route   POST /api/admin/members  |  POST /api/subadmin/members (edit permission)
const createMember = async (req, res) => {
  try {
    const { name, phone, email, photo, gender, goal, medicalNotes, status } = req.body;
    if (!name) {
      return res.status(400).json({ success: false, message: 'Member name is required' });
    }

    let planTrainerFields;
    try {
      planTrainerFields = await resolvePlanAndTrainer(req, req.body);
    } catch (err) {
      return res.status(400).json({ success: false, message: err.message });
    }

    const { scoped, subAdminId } = getSubAdminScope(req);
    if (scoped) {
      // A sub-admin without "view all" can only create members under their own care.
      planTrainerFields.assignedSubAdminId = subAdminId;
    }

    const member = await Member.create({
      subscriberId: req.user.subscriberId,
      name,
      phone,
      email,
      photo,
      gender,
      goal,
      medicalNotes,
      status: status && STATUS_VALUES.includes(status) ? status : 'active',
      ...planTrainerFields,
    });

    res.status(201).json({ success: true, message: 'Member created successfully', data: withEffectiveStatus(member) });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Update a member's profile / plan / assignment / status
// @route   PUT /api/admin/members/:id  |  PUT /api/subadmin/members/:id (edit permission)
const updateMember = async (req, res) => {
  try {
    const { scoped, subAdminId } = getSubAdminScope(req);
    const query = { _id: req.params.id, subscriberId: req.user.subscriberId };
    if (scoped) query.assignedSubAdminId = subAdminId;

    const member = await Member.findOne(query);
    if (!member) {
      return res.status(404).json({ success: false, message: 'Member not found' });
    }

    const { name, phone, email, photo, gender, goal, medicalNotes, status } = req.body;
    if (name !== undefined) member.name = name;
    if (phone !== undefined) member.phone = phone;
    if (email !== undefined) member.email = email;
    if (photo !== undefined) member.photo = photo;
    if (gender !== undefined) member.gender = gender;
    if (goal !== undefined) member.goal = goal;
    if (medicalNotes !== undefined) member.medicalNotes = medicalNotes;
    if (status !== undefined && STATUS_VALUES.includes(status)) member.status = status;

    // A restricted sub-admin may not hand a member off to someone else.
    const body = scoped ? { ...req.body, assignedSubAdminId: undefined } : req.body;
    let planTrainerFields;
    try {
      planTrainerFields = await resolvePlanAndTrainer(req, body);
    } catch (err) {
      return res.status(400).json({ success: false, message: err.message });
    }
    Object.assign(member, planTrainerFields);

    await member.save();
    res.status(200).json({ success: true, message: 'Member updated successfully', data: withEffectiveStatus(member) });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Bulk status update (e.g. bulk freeze/cancel a selection of members)
// @route   PATCH /api/admin/members/bulk-status  |  PATCH /api/subadmin/members/bulk-status (edit permission)
const bulkUpdateStatus = async (req, res) => {
  try {
    const { ids, status } = req.body;
    if (!Array.isArray(ids) || !ids.length || !STATUS_VALUES.includes(status)) {
      return res.status(400).json({ success: false, message: 'Provide member ids[] and a valid status' });
    }

    const { scoped, subAdminId } = getSubAdminScope(req);
    const query = { _id: { $in: ids }, subscriberId: req.user.subscriberId };
    if (scoped) query.assignedSubAdminId = subAdminId;

    const result = await Member.updateMany(query, { $set: { status } });
    res.status(200).json({
      success: true,
      message: `${result.modifiedCount} member(s) updated`,
      data: { matched: result.matchedCount, modified: result.modifiedCount },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

module.exports = {
  listMembers,
  listPlansLookup,
  listStaffLookup,
  getMember,
  createMember,
  updateMember,
  bulkUpdateStatus,
};
