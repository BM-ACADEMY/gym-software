const crypto = require('crypto');
const Subscriber = require('../models/Subscriber');
const PlatformPayment = require('../models/PlatformPayment');
const PlatformPlan = require('../models/PlatformPlan');
const Member = require('../models/Member');
const Payment = require('../models/Payment');
const { notifyMember } = require('./notifications');

const generateInvoiceNumber = () =>
  `PINV-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;

const generateMemberInvoiceNumber = () =>
  `INV-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;

// Auto-generates the next platform-subscription invoice for any gym whose
// billing date has arrived — the doc's "auto-generated invoices" requirement.
// Runs on the same background interval as the notification rules (server.js).
const runBillingCycle = async () => {
  const due = await Subscriber.find({
    platformPlanId: { $ne: null },
    nextBillingDate: { $lte: new Date() },
  });

  let generated = 0;
  for (const subscriber of due) {
    // Don't double-bill if an unpaid invoice for this cycle already exists.
    const existingOpen = await PlatformPayment.findOne({ subscriberId: subscriber._id, status: { $in: ['pending', 'failed'] } });
    if (existingOpen) continue;

    const plan = await PlatformPlan.findById(subscriber.platformPlanId);
    if (!plan || !plan.isActive) continue;

    await PlatformPayment.create({
      subscriberId: subscriber._id,
      planId: plan._id,
      amount: plan.price,
      status: 'pending',
      invoiceNumber: generateInvoiceNumber(),
    });

    // Advance the billing date now so the same gym isn't re-invoiced every
    // tick while this invoice is still outstanding.
    subscriber.nextBillingDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    await subscriber.save();
    generated++;
  }

  return generated;
};

// Auto-renews a member's gym plan once it expires, if the plan has
// GymPlan.autoRenew enabled — the doc's "auto-renew logic" requirement.
// Simulates a successful auto-debit the way the dummy payment gateway
// simulates any other charge (see services/paymentGateway.js): a real
// integration would replace this with an actual saved-mandate charge and
// only extend the membership once that charge succeeds.
const runMemberAutoRenewals = async (subscriberId) => {
  const query = {
    status: { $in: ['active', 'expired'] },
    expiresAt: { $lte: new Date() },
    planId: { $ne: null },
    ...(subscriberId && { subscriberId }),
  };
  const expiredMembers = await Member.find(query).populate('planId');

  let renewed = 0;
  for (const member of expiredMembers) {
    if (!member.planId || !member.planId.autoRenew || !member.planId.isActive) continue;

    await Payment.create({
      subscriberId: member.subscriberId,
      memberId: member._id,
      amount: member.planId.price,
      amountPaid: member.planId.price,
      installments: [{ amount: member.planId.price, method: 'gateway', note: `Auto-renewal — ${member.planId.name}` }],
      method: 'gateway',
      category: 'membership',
      status: 'paid',
      invoiceNumber: generateMemberInvoiceNumber(),
      paidAt: new Date(),
    });

    member.expiresAt = new Date(Date.now() + member.planId.durationDays * 24 * 60 * 60 * 1000);
    member.status = 'active';
    await member.save();

    await notifyMember(
      member,
      'plan_auto_renewed',
      `Hi ${member.name}, your "${member.planId.name}" plan was auto-renewed for ₹${member.planId.price}. New expiry: ${member.expiresAt.toDateString()}.`
    );

    renewed++;
  }

  return renewed;
};

module.exports = { runBillingCycle, runMemberAutoRenewals };
