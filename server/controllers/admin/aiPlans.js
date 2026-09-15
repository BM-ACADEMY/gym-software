const AIPlan = require('../../models/AIPlan');
const Member = require('../../models/Member');
const Subscriber = require('../../models/Subscriber');
const AuditLog = require('../../models/AuditLog');
const { generateWorkoutDietPlan } = require('../../services/ai');
const { logAudit } = require('../../utils/auditLog');

const getModulePermission = (subAdmin, moduleKey) =>
  subAdmin?.permissions?.get?.(moduleKey) || subAdmin?.permissions?.[moduleKey];

const getSubAdminScope = (req) => {
  if (req.user.role !== 'subadmin') return { scoped: false };
  const perm = getModulePermission(req.subAdmin, 'ai-plans');
  return { scoped: !perm?.viewAll, subAdminId: req.user.id };
};

const monthStart = () => {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1);
};

const assertOwnMember = async (req, memberId) => {
  const member = await Member.findOne({ _id: memberId, subscriberId: req.user.subscriberId });
  if (!member) return { error: { status: 404, message: 'Member not found' } };
  const { scoped, subAdminId } = getSubAdminScope(req);
  if (scoped && String(member.assignedSubAdminId) !== String(subAdminId)) {
    return { error: { status: 403, message: 'This member is not assigned to you' } };
  }
  return { member };
};

// @desc    Generate (or regenerate) an AI workout+diet plan for a member.
//          A sub-admin's output lands as a draft needing owner review unless
//          the gym has turned that requirement off (Subscriber.aiPlanReviewRequired).
// @route   POST /api/admin/ai-plans/generate  |  POST /api/subadmin/ai-plans/generate (edit + plan feature)
const generatePlan = async (req, res) => {
  try {
    const { memberId } = req.body;
    if (!memberId) return res.status(400).json({ success: false, message: 'memberId is required' });

    const { member, error } = await assertOwnMember(req, memberId);
    if (error) return res.status(error.status).json({ success: false, message: error.message });

    // Quota: only enforced for a 'count'-type feature with a numeric value —
    // an unlimited/toggle feature has no value and skips this entirely.
    if (req.planFeature.value !== undefined) {
      const used = await AuditLog.countDocuments({
        subscriberId: req.user.subscriberId,
        module: 'ai-plans',
        action: 'generate',
        timestamp: { $gte: monthStart() },
      });
      if (used >= req.planFeature.value) {
        return res.status(403).json({ success: false, message: `Monthly AI plan generation limit reached (${req.planFeature.value}/mo). Upgrade your plan for more.` });
      }
    }

    const latestProgress = member.progressLog?.[member.progressLog.length - 1];
    const { workoutJson, dietJson } = await generateWorkoutDietPlan({
      goal: member.goal,
      medicalNotes: member.medicalNotes,
      equipmentAvailable: member.equipmentAvailable,
      bodyStats: { weightKg: latestProgress?.weight },
    });

    const isSubAdmin = req.user.role === 'subadmin';
    let needsReview = false;
    if (isSubAdmin) {
      const subscriber = await Subscriber.findById(req.user.subscriberId).select('aiPlanReviewRequired');
      needsReview = subscriber?.aiPlanReviewRequired !== false;
    }

    const plan = await AIPlan.findOneAndUpdate(
      { subscriberId: req.user.subscriberId, memberId },
      {
        subscriberId: req.user.subscriberId,
        memberId,
        workoutJson,
        dietJson,
        lastRefreshedAt: new Date(),
        status: needsReview ? 'draft' : 'published',
        generatedBySubAdminId: isSubAdmin ? req.user.id : undefined,
        ...(needsReview ? {} : { publishedAt: new Date() }),
      },
      { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
    );

    await logAudit({ subscriberId: req.user.subscriberId, actingRole: req.user.role, actingUserId: req.user.id, module: 'ai-plans', action: 'generate', targetId: plan._id });

    res.status(200).json({
      success: true,
      message: needsReview ? 'Draft generated — awaiting owner review before it reaches the member' : 'Plan generated and published to the member',
      data: plan,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    View a member's current AI plan (draft or published)
// @route   GET /api/admin/ai-plans/member/:memberId  |  GET /api/subadmin/ai-plans/member/:memberId (view + plan feature)
const getMemberPlan = async (req, res) => {
  try {
    const { error } = await assertOwnMember(req, req.params.memberId);
    if (error) return res.status(error.status).json({ success: false, message: error.message });

    const plan = await AIPlan.findOne({ subscriberId: req.user.subscriberId, memberId: req.params.memberId }).populate('generatedBySubAdminId', 'name');
    res.status(200).json({ success: true, message: 'AI plan fetched successfully', data: plan });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Edit the AI output before publishing (or after, to correct it)
// @route   PUT /api/admin/ai-plans/member/:memberId  |  PUT /api/subadmin/ai-plans/member/:memberId (edit + plan feature)
const updatePlan = async (req, res) => {
  try {
    const { error } = await assertOwnMember(req, req.params.memberId);
    if (error) return res.status(error.status).json({ success: false, message: error.message });

    const plan = await AIPlan.findOne({ subscriberId: req.user.subscriberId, memberId: req.params.memberId });
    if (!plan) return res.status(404).json({ success: false, message: 'No AI plan found for this member — generate one first' });

    const { workoutJson, dietJson } = req.body;
    if (workoutJson !== undefined) plan.workoutJson = workoutJson;
    if (dietJson !== undefined) plan.dietJson = dietJson;
    await plan.save();

    res.status(200).json({ success: true, message: 'Plan updated successfully', data: plan });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Publish a draft to the member — Gym Owner only, regardless of a
//          sub-admin's "view all" toggle (publishing authority stays owner-reserved).
// @route   PATCH /api/admin/ai-plans/member/:memberId/publish
const publishPlan = async (req, res) => {
  try {
    const plan = await AIPlan.findOne({ subscriberId: req.user.subscriberId, memberId: req.params.memberId });
    if (!plan) return res.status(404).json({ success: false, message: 'No AI plan found for this member' });
    if (plan.status === 'published') return res.status(400).json({ success: false, message: 'Already published' });

    plan.status = 'published';
    plan.publishedAt = new Date();
    await plan.save();

    await logAudit({ subscriberId: req.user.subscriberId, actingRole: req.user.role, actingUserId: req.user.id, module: 'ai-plans', action: 'publish', targetId: plan._id });

    res.status(200).json({ success: true, message: 'Plan published to member', data: plan });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

module.exports = { generatePlan, getMemberPlan, updatePlan, publishPlan };
