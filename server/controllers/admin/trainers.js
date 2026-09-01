const mongoose = require('mongoose');
const SubAdmin = require('../../models/SubAdmin');
const Member = require('../../models/Member');

const toSafeTrainer = (subAdmin) => {
  const obj = subAdmin.toObject ? subAdmin.toObject() : subAdmin;
  delete obj.passwordHash;
  delete obj.otpCode;
  delete obj.otpExpiresAt;
  delete obj.permissions;
  return obj;
};

// @desc    Trainer directory — sub-admins tagged as trainer-type, with their assigned member count
// @route   GET /api/admin/trainers
const listTrainers = async (req, res) => {
  try {
    const trainers = await SubAdmin.find({ subscriberId: req.user.subscriberId, template: 'trainer' }).sort({ name: 1 });
    const counts = await Member.aggregate([
      { $match: { subscriberId: new mongoose.Types.ObjectId(req.user.subscriberId) } },
      { $group: { _id: '$assignedSubAdminId', count: { $sum: 1 } } },
    ]);
    const countByTrainerId = new Map(counts.map((c) => [String(c._id), c.count]));

    const data = trainers.map((t) => ({ ...toSafeTrainer(t), assignedMemberCount: countByTrainerId.get(String(t._id)) || 0 }));
    res.status(200).json({ success: true, message: 'Trainers fetched successfully', data });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Members currently assigned to one trainer
// @route   GET /api/admin/trainers/:id/members
const getTrainerMembers = async (req, res) => {
  try {
    const trainer = await SubAdmin.findOne({ _id: req.params.id, subscriberId: req.user.subscriberId, template: 'trainer' });
    if (!trainer) {
      return res.status(404).json({ success: false, message: 'Trainer not found' });
    }
    const members = await Member.find({ subscriberId: req.user.subscriberId, assignedSubAdminId: trainer._id }).select('name phone status expiresAt');
    res.status(200).json({ success: true, message: 'Trainer members fetched successfully', data: members });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Update a trainer's specialization / base salary / PT commission %
// @route   PUT /api/admin/trainers/:id
const updateTrainer = async (req, res) => {
  try {
    const trainer = await SubAdmin.findOne({ _id: req.params.id, subscriberId: req.user.subscriberId, template: 'trainer' });
    if (!trainer) {
      return res.status(404).json({ success: false, message: 'Trainer not found' });
    }

    const { specialization, baseSalary, ptCommissionPercent } = req.body;
    if (specialization !== undefined) trainer.specialization = specialization;
    if (baseSalary !== undefined) trainer.baseSalary = baseSalary === '' ? undefined : Number(baseSalary);
    if (ptCommissionPercent !== undefined) {
      const pct = ptCommissionPercent === '' ? undefined : Number(ptCommissionPercent);
      if (pct !== undefined && (pct < 0 || pct > 100)) {
        return res.status(400).json({ success: false, message: 'PT commission % must be between 0 and 100' });
      }
      trainer.ptCommissionPercent = pct;
    }

    await trainer.save();
    res.status(200).json({ success: true, message: 'Trainer updated successfully', data: toSafeTrainer(trainer) });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Assign (or reassign) a member to a trainer
// @route   PATCH /api/admin/trainers/assign
const assignMember = async (req, res) => {
  try {
    const { memberId, trainerId } = req.body;
    if (!memberId || !trainerId) {
      return res.status(400).json({ success: false, message: 'memberId and trainerId are required' });
    }

    const [member, trainer] = await Promise.all([
      Member.findOne({ _id: memberId, subscriberId: req.user.subscriberId }),
      SubAdmin.findOne({ _id: trainerId, subscriberId: req.user.subscriberId, template: 'trainer' }),
    ]);
    if (!member) return res.status(404).json({ success: false, message: 'Member not found' });
    if (!trainer) return res.status(404).json({ success: false, message: 'Trainer not found' });

    member.assignedSubAdminId = trainer._id;
    await member.save();

    res.status(200).json({ success: true, message: `${member.name} assigned to ${trainer.name}`, data: member });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

module.exports = { listTrainers, getTrainerMembers, updateTrainer, assignMember };
