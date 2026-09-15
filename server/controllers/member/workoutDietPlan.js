const Workout = require('../../models/Workout');
const Member = require('../../models/Member');
const AIPlan = require('../../models/AIPlan');

// @desc    View assigned workout routine + the AI-generated workout/diet plan
//          (only once a Gym Owner/trainer has published it — a draft awaiting
//          review is never visible here).
// @route   GET /api/member/workout-diet-plan
const getMyWorkout = async (req, res) => {
  try {
    const [workout, aiPlan] = await Promise.all([
      Workout.findOne({ memberId: req.user.id }).populate('templateId', 'name level focus'),
      AIPlan.findOne({ memberId: req.user.id, status: 'published' }),
    ]);
    res.status(200).json({ success: true, message: 'Workout fetched successfully', data: { workout, aiPlan } });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Mark today's workout done — feeds the streak
// @route   POST /api/member/workout-diet-plan/mark-done
const markDone = async (req, res) => {
  try {
    const workout = await Workout.findOne({ memberId: req.user.id });
    if (!workout) return res.status(404).json({ success: false, message: 'No workout assigned yet' });

    const today = new Date().toISOString().slice(0, 10);
    if (!workout.completedDates.includes(today)) {
      workout.completedDates.push(today);
      await workout.save();
    }
    res.status(200).json({ success: true, message: 'Marked done for today', data: workout });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Log weight/measurements/photo progress. Doesn't auto-regenerate the
//          AI plan (that stays a deliberate trainer/owner action, not silent
//          and quota-consuming on every log) — but the next time they
//          regenerate, this becomes the latest body-stats input used.
// @route   POST /api/member/workout-diet-plan/progress
const logProgress = async (req, res) => {
  try {
    const { weight, measurements, photoUrl } = req.body;
    if (weight === undefined && !measurements && !photoUrl) {
      return res.status(400).json({ success: false, message: 'Provide at least one of weight, measurements, or photoUrl' });
    }

    const member = await Member.findById(req.user.id);
    member.progressLog.push({ weight, measurements, photoUrl, loggedAt: new Date() });
    await member.save();

    res.status(201).json({ success: true, message: 'Progress logged successfully', data: member.progressLog });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

module.exports = { getMyWorkout, markDone, logProgress };
