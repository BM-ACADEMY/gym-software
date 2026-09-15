const mongoose = require('mongoose');
const WorkoutTemplate = require('../../models/WorkoutTemplate');
const Workout = require('../../models/Workout');
const Member = require('../../models/Member');

const getModulePermission = (subAdmin, moduleKey) =>
  subAdmin?.permissions?.get?.(moduleKey) || subAdmin?.permissions?.[moduleKey];

// Matches SUBADMIN_NAV's key for this module, which is 'workout' (singular) —
// not 'workouts' like the Gym Owner nav entry.
const getSubAdminScope = (req) => {
  if (req.user.role !== 'subadmin') return { scoped: false };
  const perm = getModulePermission(req.subAdmin, 'workout');
  return { scoped: !perm?.viewAll, subAdminId: req.user.id };
};

// @desc    List the reusable workout template library, with how many members are on each
// @route   GET /api/admin/workouts/templates  |  GET /api/subadmin/workouts/templates (view)
const listTemplates = async (req, res) => {
  try {
    const templates = await WorkoutTemplate.find({ subscriberId: req.user.subscriberId }).sort({ name: 1 });
    const counts = await Workout.aggregate([
      { $match: { subscriberId: new mongoose.Types.ObjectId(req.user.subscriberId), templateId: { $ne: null } } },
      { $group: { _id: '$templateId', count: { $sum: 1 } } },
    ]);
    const countByTemplateId = new Map(counts.map((c) => [String(c._id), c.count]));

    const data = templates.map((t) => ({ ...t.toObject(), assignedMemberCount: countByTemplateId.get(String(t._id)) || 0 }));
    res.status(200).json({ success: true, message: 'Templates fetched successfully', data });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Create a reusable workout template
// @route   POST /api/admin/workouts/templates  |  POST /api/subadmin/workouts/templates (edit)
const createTemplate = async (req, res) => {
  try {
    const { name, level, daysPerWeek, focus, planData } = req.body;
    if (!name) {
      return res.status(400).json({ success: false, message: 'Template name is required' });
    }

    const template = await WorkoutTemplate.create({
      subscriberId: req.user.subscriberId,
      name,
      level,
      daysPerWeek,
      focus,
      planData: planData || {},
      createdBySubAdminId: req.user.role === 'subadmin' ? req.user.id : undefined,
    });

    res.status(201).json({ success: true, message: 'Template created successfully', data: { ...template.toObject(), assignedMemberCount: 0 } });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Update a workout template (does not retroactively change members already assigned from it)
// @route   PUT /api/admin/workouts/templates/:id  |  PUT /api/subadmin/workouts/templates/:id (edit)
const updateTemplate = async (req, res) => {
  try {
    const template = await WorkoutTemplate.findOne({ _id: req.params.id, subscriberId: req.user.subscriberId });
    if (!template) {
      return res.status(404).json({ success: false, message: 'Template not found' });
    }

    const { name, level, daysPerWeek, focus, planData } = req.body;
    if (name !== undefined) template.name = name;
    if (level !== undefined) template.level = level;
    if (daysPerWeek !== undefined) template.daysPerWeek = daysPerWeek;
    if (focus !== undefined) template.focus = focus;
    if (planData !== undefined) template.planData = planData;
    await template.save();

    res.status(200).json({ success: true, message: 'Template updated successfully', data: template });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Get a member's currently-assigned workout
// @route   GET /api/admin/workouts/member/:memberId  |  GET /api/subadmin/workouts/member/:memberId (view)
const getMemberWorkout = async (req, res) => {
  try {
    const member = await Member.findOne({ _id: req.params.memberId, subscriberId: req.user.subscriberId });
    if (!member) return res.status(404).json({ success: false, message: 'Member not found' });

    const { scoped, subAdminId } = getSubAdminScope(req);
    if (scoped && String(member.assignedSubAdminId) !== String(subAdminId)) {
      return res.status(403).json({ success: false, message: 'This member is not assigned to you' });
    }

    const workout = await Workout.findOne({ memberId: member._id, subscriberId: req.user.subscriberId }).populate('templateId', 'name level focus');
    res.status(200).json({ success: true, message: 'Workout fetched successfully', data: workout });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Assign a template (or a hand-authored plan) to a member — creates or replaces their current workout
// @route   PUT /api/admin/workouts/member/:memberId  |  PUT /api/subadmin/workouts/member/:memberId (edit)
const assignMemberWorkout = async (req, res) => {
  try {
    const { templateId, planData } = req.body;
    if (!templateId && !planData) {
      return res.status(400).json({ success: false, message: 'Provide a templateId to assign, planData to author manually, or both' });
    }

    const member = await Member.findOne({ _id: req.params.memberId, subscriberId: req.user.subscriberId });
    if (!member) return res.status(404).json({ success: false, message: 'Member not found' });

    const { scoped, subAdminId } = getSubAdminScope(req);
    if (scoped && String(member.assignedSubAdminId) !== String(subAdminId)) {
      return res.status(403).json({ success: false, message: 'This member is not assigned to you' });
    }

    let resolvedPlanData = planData;
    if (templateId) {
      const template = await WorkoutTemplate.findOne({ _id: templateId, subscriberId: req.user.subscriberId });
      if (!template) return res.status(404).json({ success: false, message: 'Template not found' });
      if (resolvedPlanData === undefined) resolvedPlanData = template.planData;
    }

    const workout = await Workout.findOneAndUpdate(
      { memberId: member._id, subscriberId: req.user.subscriberId },
      {
        subscriberId: req.user.subscriberId,
        memberId: member._id,
        subAdminId: req.user.role === 'subadmin' ? req.user.id : undefined,
        templateId: templateId || undefined,
        planData: resolvedPlanData,
        generatedBy: 'manual',
      },
      { upsert: true, returnDocument: 'after' }
    );

    res.status(200).json({ success: true, message: 'Workout assigned successfully', data: workout });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

module.exports = { listTemplates, createTemplate, updateTemplate, getMemberWorkout, assignMemberWorkout };
