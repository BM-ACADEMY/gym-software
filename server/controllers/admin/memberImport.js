const Member = require('../../models/Member');
const GymPlan = require('../../models/GymPlan');
const { parseRows, resolveExpiry } = require('../../services/memberImport');
const { remainingCapacity } = require('../../middleware/planLimits');
const { logAudit } = require('../../utils/auditLog');

// @desc    Import members from spreadsheet rows. commit=false only checks the rows.
// @route   POST /api/admin/members/import   { rows: [...], commit: boolean }
const importMembers = async (req, res) => {
  try {
    const { rows, commit } = req.body;
    if (!Array.isArray(rows)) return res.status(400).json({ success: false, message: 'rows must be a list' });
    if (rows.some((r) => !r || typeof r !== 'object' || Array.isArray(r))) {
      return res.status(400).json({ success: false, message: 'Each row must be an object' });
    }

    const parsed = parseRows(rows);
    if (parsed.fatal) return res.status(400).json({ success: false, message: parsed.fatal });

    const subscriberId = req.user.subscriberId;
    const { records, errors } = parsed;
    const problems = [...errors];

    const plans = await GymPlan.find({ subscriberId }).select('name durationDays');
    const planByName = new Map(plans.map((p) => [p.name.trim().toLowerCase(), p]));

    const existing = await Member.find({ subscriberId, phone: { $in: records.map((r) => r.phone) } }).select('phone');
    const existingPhones = new Set(existing.map((m) => m.phone));

    const capacity = await remainingCapacity(subscriberId, 'member');
    const toCreate = [];
    const unknownPlans = new Set();
    let skippedExisting = 0;

    for (const rec of records) {
      if (existingPhones.has(rec.phone)) { skippedExisting++; continue; }
      if (toCreate.length >= capacity) {
        problems.push({ row: rec.row, name: rec.name, message: 'Your plan member limit is full. Upgrade to add more.' });
        continue;
      }
      let plan;
      if (rec.planName) {
        plan = planByName.get(rec.planName.toLowerCase());
        if (!plan) unknownPlans.add(rec.planName);
      }
      toCreate.push({
        subscriberId, name: rec.name, phone: rec.phone, email: rec.email, gender: rec.gender,
        goal: rec.goal, medicalNotes: rec.medicalNotes, deviceUserId: rec.deviceUserId,
        planId: plan?._id, expiresAt: resolveExpiry(rec, plan), status: 'active',
      });
    }

    const summary = {
      total: records.length + errors.length,
      willCreate: toCreate.length,
      skippedExisting,
      errorCount: problems.length,
      errors: problems.slice(0, 100),
      unknownPlans: [...unknownPlans],
      unknownColumns: parsed.unknownHeaders,
    };

    if (!commit) return res.json({ success: true, data: { ...summary, committed: false } });

    if (toCreate.length) await Member.insertMany(toCreate, { ordered: false });
    await logAudit({
      subscriberId, actingRole: 'admin', actingUserId: req.user.id, module: 'members',
      action: `import_members:${toCreate.length}`,
    });
    res.status(201).json({ success: true, data: { ...summary, created: toCreate.length, committed: true } });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

module.exports = { importMembers };
