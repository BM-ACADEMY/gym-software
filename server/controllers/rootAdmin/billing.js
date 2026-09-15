const crypto = require('crypto');
const PlatformPayment = require('../../models/PlatformPayment');
const Subscriber = require('../../models/Subscriber');
const PlatformPlan = require('../../models/PlatformPlan');
const Admin = require('../../models/Admin');
const { notifyAdmin } = require('../../services/notifications');
const { logAudit } = require('../../utils/auditLog');

const generateInvoiceNumber = () =>
  `PINV-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;

// A pending invoice unpaid this long is treated as failed and enters the retry/dunning queue.
const GRACE_DAYS = 7;

// @desc    List platform invoices, filterable
// @route   GET /api/root-admin/billing/invoices
const listInvoices = async (req, res) => {
  try {
    const { status, subscriberId } = req.query;
    const query = {};
    if (status) query.status = status;
    if (subscriberId) query.subscriberId = subscriberId;

    const invoices = await PlatformPayment.find(query)
      .populate('subscriberId', 'gymName')
      .populate('planId', 'name price')
      .sort({ createdAt: -1 })
      .limit(200);

    res.status(200).json({ success: true, message: 'Invoices fetched successfully', data: invoices });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Manually generate/record an invoice for a gym's platform subscription
// @route   POST /api/root-admin/billing/invoices
const createInvoice = async (req, res) => {
  try {
    const { subscriberId, planId } = req.body;
    if (!subscriberId) return res.status(400).json({ success: false, message: 'subscriberId is required' });

    const subscriber = await Subscriber.findById(subscriberId);
    if (!subscriber) return res.status(404).json({ success: false, message: 'Subscriber not found' });

    const targetPlanId = planId || subscriber.platformPlanId;
    if (!targetPlanId) return res.status(400).json({ success: false, message: 'This gym has no platform plan assigned yet' });

    const plan = await PlatformPlan.findById(targetPlanId);
    if (!plan) return res.status(404).json({ success: false, message: 'Platform plan not found' });

    const invoice = await PlatformPayment.create({
      subscriberId,
      planId: plan._id,
      amount: plan.price,
      status: 'pending',
      invoiceNumber: generateInvoiceNumber(),
    });

    await logAudit({ subscriberId, actingRole: 'root_admin', actingUserId: req.user.id, module: 'billing', action: 'create_invoice', targetId: invoice._id });

    res.status(201).json({ success: true, message: 'Invoice created successfully', data: invoice });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Mark an invoice paid (no gateway yet — manual/offline payment recorded directly)
// @route   PATCH /api/root-admin/billing/invoices/:id/mark-paid
const markPaid = async (req, res) => {
  try {
    const invoice = await PlatformPayment.findById(req.params.id);
    if (!invoice) return res.status(404).json({ success: false, message: 'Invoice not found' });
    if (invoice.status === 'paid') return res.status(400).json({ success: false, message: 'Already paid' });

    invoice.status = 'paid';
    invoice.paidAt = new Date();
    await invoice.save();

    // Paying reactivates a gym that was suspended for non-payment and rolls
    // the next billing date forward one cycle (30 days).
    await Subscriber.findByIdAndUpdate(invoice.subscriberId, {
      isActive: true,
      nextBillingDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      platformPlanId: invoice.planId,
    });

    await logAudit({ subscriberId: invoice.subscriberId, actingRole: 'root_admin', actingUserId: req.user.id, module: 'billing', action: 'mark_paid', targetId: invoice._id });

    res.status(200).json({ success: true, message: 'Invoice marked paid', data: invoice });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Failed-payment retry queue — pending invoices past the grace period
// @route   GET /api/root-admin/billing/failed-queue
const getFailedQueue = async (req, res) => {
  try {
    const cutoff = new Date(Date.now() - GRACE_DAYS * 24 * 60 * 60 * 1000);
    const invoices = await PlatformPayment.find({
      status: { $in: ['pending', 'failed'] },
      createdAt: { $lt: cutoff },
    })
      .populate('subscriberId', 'gymName isActive')
      .populate('planId', 'name price')
      .sort({ createdAt: 1 });

    res.status(200).json({ success: true, message: 'Failed-payment queue fetched successfully', data: invoices });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Retry a failed invoice — sends a fresh dunning email/notification to the gym owner
// @route   POST /api/root-admin/billing/invoices/:id/retry
const retryInvoice = async (req, res) => {
  try {
    const invoice = await PlatformPayment.findById(req.params.id).populate('planId', 'name price');
    if (!invoice) return res.status(404).json({ success: false, message: 'Invoice not found' });
    if (invoice.status === 'paid') return res.status(400).json({ success: false, message: 'Already paid' });

    invoice.status = 'failed';
    invoice.retryCount += 1;
    invoice.lastDunningAt = new Date();
    await invoice.save();

    const admin = await Admin.findOne({ subscriberId: invoice.subscriberId });
    if (admin) {
      await notifyAdmin(
        admin,
        'platform_payment_failed',
        `Your GymDesk subscription payment of ₹${invoice.amount} (${invoice.planId?.name || 'your plan'}) is overdue. Please pay to avoid suspension. Invoice ${invoice.invoiceNumber}.`
      );
    }

    res.status(200).json({ success: true, message: 'Dunning notice sent', data: invoice });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

module.exports = { listInvoices, createInvoice, markPaid, getFailedQueue, retryInvoice };
