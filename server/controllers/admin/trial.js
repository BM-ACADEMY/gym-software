const Trial = require('../../models/Trial');
const Member = require('../../models/Member');
const GymPlan = require('../../models/GymPlan');
const SubAdmin = require('../../models/SubAdmin');

const OPEN_STATUSES = ['booked', 'attended', 'lost'];

// Display-only flag for "about to lapse" — the actual reminder dispatch
// belongs to the Notifications service (a later task); this just exposes
// the data it will need.
const withLapsingSoon = (trialDoc) => {
  const trial = trialDoc.toObject ? trialDoc.toObject() : trialDoc;
  let lapsingSoon = false;
  if (['booked', 'attended'].includes(trial.status) && trial.preferredDate) {
    const in3Days = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
    lapsingSoon = new Date(trial.preferredDate) <= in3Days;
  }
  return { ...trial, lapsingSoon };
};

// @desc    List trial leads, optionally filtered by status
// @route   GET /api/admin/trial
const listTrials = async (req, res) => {
  try {
    const { status } = req.query;
    const query = { subscriberId: req.user.subscriberId };
    if (status) query.status = status;

    const trials = await Trial.find(query).populate('assignedSubAdminId', 'name').sort({ preferredDate: 1 });
    res.status(200).json({ success: true, message: 'Trial leads fetched successfully', data: trials.map(withLapsingSoon) });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Add a new trial lead
// @route   POST /api/admin/trial
const createTrial = async (req, res) => {
  try {
    const { name, phone, preferredDate, assignedSubAdminId } = req.body;
    if (!name || !phone) {
      return res.status(400).json({ success: false, message: 'Name and phone are required' });
    }

    if (assignedSubAdminId) {
      const staff = await SubAdmin.findOne({ _id: assignedSubAdminId, subscriberId: req.user.subscriberId });
      if (!staff) return res.status(404).json({ success: false, message: 'Assigned staff member not found' });
    }

    const trial = await Trial.create({
      subscriberId: req.user.subscriberId,
      name,
      phone,
      preferredDate,
      assignedSubAdminId: assignedSubAdminId || undefined,
    });

    res.status(201).json({ success: true, message: 'Trial lead added successfully', data: withLapsingSoon(trial) });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Update a trial lead's details or move it through booked/attended/lost
//          ('converted' has its own endpoint since it also creates a Member)
// @route   PUT /api/admin/trial/:id
const updateTrial = async (req, res) => {
  try {
    const trial = await Trial.findOne({ _id: req.params.id, subscriberId: req.user.subscriberId });
    if (!trial) {
      return res.status(404).json({ success: false, message: 'Trial lead not found' });
    }
    if (trial.status === 'converted') {
      return res.status(400).json({ success: false, message: 'This lead has already converted to a member' });
    }

    const { name, phone, preferredDate, status, assignedSubAdminId } = req.body;
    if (name !== undefined) trial.name = name;
    if (phone !== undefined) trial.phone = phone;
    if (preferredDate !== undefined) trial.preferredDate = preferredDate;
    if (assignedSubAdminId !== undefined) trial.assignedSubAdminId = assignedSubAdminId || undefined;
    if (status !== undefined) {
      if (status === 'converted') {
        return res.status(400).json({ success: false, message: 'Use the convert action to move a lead to converted' });
      }
      if (!OPEN_STATUSES.includes(status)) {
        return res.status(400).json({ success: false, message: 'Invalid status' });
      }
      trial.status = status;
    }

    await trial.save();
    res.status(200).json({ success: true, message: 'Trial lead updated successfully', data: withLapsingSoon(trial) });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Convert a trial lead into a real Member
// @route   PATCH /api/admin/trial/:id/convert
const convertTrial = async (req, res) => {
  try {
    const trial = await Trial.findOne({ _id: req.params.id, subscriberId: req.user.subscriberId });
    if (!trial) {
      return res.status(404).json({ success: false, message: 'Trial lead not found' });
    }
    if (trial.status === 'converted') {
      return res.status(400).json({ success: false, message: 'This lead has already converted' });
    }

    const existingMember = await Member.findOne({ subscriberId: req.user.subscriberId, phone: trial.phone });
    if (existingMember) {
      return res.status(400).json({ success: false, message: 'A member with this phone number already exists for this gym' });
    }

    const { planId } = req.body;
    const memberData = {
      subscriberId: req.user.subscriberId,
      name: trial.name,
      phone: trial.phone,
      assignedSubAdminId: trial.assignedSubAdminId,
      status: 'trial',
    };

    if (planId) {
      const plan = await GymPlan.findOne({ _id: planId, subscriberId: req.user.subscriberId });
      if (!plan) return res.status(404).json({ success: false, message: 'Selected plan was not found for this gym' });
      memberData.planId = plan._id;
      memberData.status = 'active';
      memberData.expiresAt = new Date(Date.now() + plan.durationDays * 24 * 60 * 60 * 1000);
    }

    const member = await Member.create(memberData);
    trial.status = 'converted';
    trial.convertedMemberId = member._id;
    await trial.save();

    res.status(200).json({ success: true, message: `${trial.name} converted to a member`, data: { trial: withLapsingSoon(trial), member } });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

module.exports = { listTrials, createTrial, updateTrial, convertTrial };
