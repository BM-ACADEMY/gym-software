const mongoose = require('mongoose');
const { escapeRegex } = require('../../utils/escapeRegex');
const Subscriber = require('../../models/Subscriber');
const Admin = require('../../models/Admin');
const SubAdmin = require('../../models/SubAdmin');
const Member = require('../../models/Member');
const Payment = require('../../models/Payment');
const PlatformPlan = require('../../models/PlatformPlan');
const { generateToken } = require('../../utils/jwt');
const { logAudit } = require('../../utils/auditLog');
const bin = require('../../services/gymBin');

const IN_BIN = 'This gym is in the deleted list. Restore it first.';

// @desc    List/search/filter all gyms
// @route   GET /api/root-admin/subscribers
const listSubscribers = async (req, res) => {
  try {
    const { search, status, dateFrom, dateTo } = req.query;
    // status=deleted lists the 30-day bin; every other view leaves binned gyms out.
    const query = { deletedAt: status === 'deleted' ? { $ne: null } : null };
    if (search) query.gymName = { $regex: escapeRegex(search), $options: 'i' };
    if (status === 'active') query.isActive = true;
    if (status === 'inactive') query.isActive = false;
    if (dateFrom || dateTo) {
      query.createdAt = {};
      if (dateFrom) query.createdAt.$gte = new Date(dateFrom);
      if (dateTo) { const end = new Date(dateTo); end.setHours(23, 59, 59, 999); query.createdAt.$lte = end; }
    }

    const subscribers = await Subscriber.find(query).sort({ createdAt: -1 });
    const admins = await Admin.find({ subscriberId: { $in: subscribers.map((s) => s._id) } }).select('subscriberId name email phone');
    const adminBySubscriber = new Map(admins.map((a) => [String(a.subscriberId), a]));

    const data = subscribers.map((s) => ({
      ...s.toObject(), owner: adminBySubscriber.get(String(s._id)) || null, ...(s.deletedAt && { purgeAt: bin.purgeDate(s.deletedAt) }),
    }));
    res.status(200).json({ success: true, message: 'Subscribers fetched successfully', data });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Drill into a gym: usage stats, staff count, member count, payment history
// @route   GET /api/root-admin/subscribers/:id
const getSubscriberDetail = async (req, res) => {
  try {
    const subscriber = await Subscriber.findById(req.params.id).populate('platformPlanId', 'name price');
    if (!subscriber) return res.status(404).json({ success: false, message: 'Subscriber not found' });

    const subscriberObjectId = new mongoose.Types.ObjectId(req.params.id);
    const [owner, memberCount, activeMemberCount, staffCount, recentPayments, revenueAgg] = await Promise.all([
      Admin.findOne({ subscriberId: req.params.id }).select('name email phone createdAt'),
      Member.countDocuments({ subscriberId: req.params.id }),
      Member.countDocuments({ subscriberId: req.params.id, status: 'active' }),
      SubAdmin.countDocuments({ subscriberId: req.params.id, isActive: true }),
      Payment.find({ subscriberId: req.params.id }).populate('memberId', 'name').sort({ createdAt: -1 }).limit(10),
      Payment.aggregate([
        { $match: { subscriberId: subscriberObjectId } },
        { $unwind: '$installments' },
        { $group: { _id: null, total: { $sum: '$installments.amount' } } },
      ]),
    ]);

    res.status(200).json({
      success: true,
      message: 'Subscriber detail fetched successfully',
      data: {
        subscriber,
        owner,
        stats: { memberCount, activeMemberCount, staffCount, totalRevenue: revenueAgg[0]?.total || 0 },
        recentPayments,
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Manually put a gym on a different platform plan — a support action
//          for comping a plan, correcting a billing mistake, or granting a
//          custom arrangement, independent of the gym's own checkout/webhook flow.
// @route   PATCH /api/root-admin/subscribers/:id/plan
const overrideSubscriberPlan = async (req, res) => {
  try {
    const { platformPlanId, nextBillingDate } = req.body;
    if (!platformPlanId) {
      return res.status(400).json({ success: false, message: 'platformPlanId is required' });
    }

    const [subscriber, plan] = await Promise.all([
      Subscriber.findById(req.params.id),
      PlatformPlan.findById(platformPlanId),
    ]);
    if (!subscriber) return res.status(404).json({ success: false, message: 'Subscriber not found' });
    if (!plan) return res.status(404).json({ success: false, message: 'Platform plan not found' });

    subscriber.platformPlanId = plan._id;
    subscriber.planStartedAt = new Date();
    subscriber.nextBillingDate = nextBillingDate ? new Date(nextBillingDate) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    await subscriber.save();

    await logAudit({
      subscriberId: subscriber._id,
      actingRole: 'root_admin',
      actingUserId: req.user.id,
      module: 'subscribers',
      action: 'plan_override',
      targetId: plan._id,
    });

    res.status(200).json({ success: true, message: `${subscriber.gymName} moved to the "${plan.name}" plan`, data: subscriber });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Suspend a gym (blocks their access without deleting anything)
// @route   PATCH /api/root-admin/subscribers/:id/suspend
const suspendSubscriber = async (req, res) => {
  try {
    const subscriber = await Subscriber.findByIdAndUpdate(req.params.id, { isActive: false }, { returnDocument: 'after' });
    if (!subscriber) return res.status(404).json({ success: false, message: 'Subscriber not found' });
    await logAudit({ subscriberId: subscriber._id, actingRole: 'root_admin', actingUserId: req.user.id, module: 'subscribers', action: 'suspend', targetId: subscriber._id });
    res.status(200).json({ success: true, message: 'Subscriber suspended', data: subscriber });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Reactivate a suspended gym
// @route   PATCH /api/root-admin/subscribers/:id/activate
const activateSubscriber = async (req, res) => {
  try {
    if (await Subscriber.exists({ _id: req.params.id, deletedAt: { $ne: null } })) return res.status(400).json({ success: false, message: IN_BIN });
    const subscriber = await Subscriber.findByIdAndUpdate(req.params.id, { isActive: true }, { returnDocument: 'after' });
    if (!subscriber) return res.status(404).json({ success: false, message: 'Subscriber not found' });
    await logAudit({ subscriberId: subscriber._id, actingRole: 'root_admin', actingUserId: req.user.id, module: 'subscribers', action: 'activate', targetId: subscriber._id });
    res.status(200).json({ success: true, message: 'Subscriber activated', data: subscriber });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const findGym = async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) { res.status(404).json({ success: false, message: 'Subscriber not found' }); return null; }
  const subscriber = await Subscriber.findById(req.params.id);
  if (!subscriber) { res.status(404).json({ success: false, message: 'Subscriber not found' }); return null; }
  return subscriber;
};

// @desc    Delete a gym: it goes to the deleted list for 30 days, closed to its users, and can be restored (RM-10)
// @route   DELETE /api/root-admin/subscribers/:id
const deleteSubscriber = async (req, res) => {
  try {
    const subscriber = await findGym(req, res); if (!subscriber) return;
    if (subscriber.deletedAt) return res.status(400).json({ success: false, message: 'This gym is already in the deleted list.' });
    const purgeAt = await bin.moveToBin(subscriber, req.user.id);
    await logAudit({ subscriberId: subscriber._id, actingRole: 'root_admin', actingUserId: req.user.id, module: 'subscribers', action: 'move_to_deleted', targetId: subscriber._id });
    res.status(200).json({ success: true, message: `${subscriber.gymName} is in the deleted list. It can be restored until ${purgeAt.toDateString()}.`, data: { purgeAt } });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Bring a gym back from the deleted list, with everything it had
// @route   POST /api/root-admin/subscribers/:id/restore
const restoreSubscriber = async (req, res) => {
  try {
    const subscriber = await findGym(req, res); if (!subscriber) return;
    if (!subscriber.deletedAt) return res.status(400).json({ success: false, message: 'This gym is not in the deleted list.' });
    await bin.restoreFromBin(subscriber);
    await logAudit({ subscriberId: subscriber._id, actingRole: 'root_admin', actingUserId: req.user.id, module: 'subscribers', action: 'restore', targetId: subscriber._id });
    res.status(200).json({ success: true, message: `${subscriber.gymName} has been restored`, data: subscriber });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Delete a gym and all its data for good. Only from the deleted list, so it always takes two steps.
// @route   DELETE /api/root-admin/subscribers/:id/permanent
const purgeSubscriber = async (req, res) => {
  try {
    const subscriber = await findGym(req, res); if (!subscriber) return;
    if (!subscriber.deletedAt) return res.status(400).json({ success: false, message: 'Delete the gym first; it can be removed for good from the deleted list.' });
    await bin.purgeGym(subscriber._id, req.user.id);
    res.status(200).json({ success: true, message: `${subscriber.gymName} and all its data have been deleted for good` });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Impersonate a gym's owner for support/troubleshooting — audited, short-lived token
// @route   POST /api/root-admin/subscribers/:id/impersonate
const impersonateSubscriber = async (req, res) => {
  try {
    const subscriber = await Subscriber.findById(req.params.id);
    if (!subscriber) return res.status(404).json({ success: false, message: 'Subscriber not found' });
    if (subscriber.deletedAt) return res.status(400).json({ success: false, message: IN_BIN });

    const admin = await Admin.findOne({ subscriberId: req.params.id });
    if (!admin) return res.status(404).json({ success: false, message: 'This gym has no owner account to impersonate' });

    const token = generateToken({ id: admin._id, role: admin.role, subscriberId: subscriber._id, impersonatedBy: req.user.id }, '1h');

    await logAudit({ subscriberId: subscriber._id, actingRole: 'root_admin', actingUserId: req.user.id, module: 'subscribers', action: 'impersonate', targetId: admin._id });

    res.status(200).json({
      success: true,
      message: `Impersonating ${admin.name} (${subscriber.gymName})`,
      data: {
        token,
        user: { id: admin._id, name: admin.name, email: admin.email, phone: admin.phone, role: admin.role, subscriberId: subscriber._id, impersonatedBy: req.user.id },
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

module.exports = { listSubscribers, getSubscriberDetail, overrideSubscriberPlan, suspendSubscriber, activateSubscriber, deleteSubscriber, restoreSubscriber, purgeSubscriber, impersonateSubscriber };
