// Seeds the two subscription layers with demo data so the Plan Creation /
// Subscription Plan UIs aren't empty on first login. Re-runnable (upserts).
// Usage: node scripts/seedPlans.js
require('dotenv').config();
const mongoose = require('mongoose');

const connectDB = require('../config/db');
const Admin = require('../models/Admin');
const PlatformPlan = require('../models/PlatformPlan');
const GymPlan = require('../models/GymPlan');
const Member = require('../models/Member');

const PLATFORM_PLANS = [
  { name: 'Starter', price: 999, memberLimit: 100, staffLimit: 1, trialDays: 0, features: ['Core modules', 'Attendance', 'Payments', 'Manual reminders'] },
  { name: 'Growth', price: 2499, memberLimit: 500, staffLimit: 5, trialDays: 0, features: ['PT Sessions', 'Earnings', 'AI Workout Plans (limited/mo)', 'SMS/Email reminders'] },
  { name: 'Pro', price: 4999, memberLimit: undefined, staffLimit: undefined, trialDays: 0, features: ['Unlimited AI Plans', 'Accounts/Expense tracking', 'Advanced Analytics', 'Branded member app'] },
  { name: 'Trial', price: 0, memberLimit: 25, staffLimit: 1, trialDays: 14, features: ['All Growth features', 'Watermarked reports', 'Auto-expires'] },
];

const GYM_PLANS = [
  { name: 'Monthly Basic', durationDays: 30, price: 1500, includedServices: ['Gym Access'], trialEligible: true, autoRenew: false, allowFreeze: true, maxFreezeDays: 7 },
  { name: 'Quarterly Gold', durationDays: 90, price: 4000, includedServices: ['Gym Access', 'Personal Training'], trialEligible: false, autoRenew: true, allowFreeze: true, maxFreezeDays: 15 },
  { name: 'Annual + PT', durationDays: 365, price: 14000, includedServices: ['Gym Access', 'Personal Training', 'Diet Plan', 'AI Workout Plan'], trialEligible: false, autoRenew: true, allowFreeze: true, maxFreezeDays: 30 },
];

const OWNER_PHONE = '8807226257';
const MEMBER_PHONE = '9486788591';

async function seed() {
  await connectDB();

  for (const p of PLATFORM_PLANS) {
    await PlatformPlan.findOneAndUpdate({ name: p.name }, p, { upsert: true, setDefaultsOnInsert: true });
  }
  console.log(`✔ ${PLATFORM_PLANS.length} platform plans ready`);

  const admin = await Admin.findOne({ phone: OWNER_PHONE });
  if (!admin) {
    console.log('⚠ No gym owner found — run scripts/seedDemoUsers.js first. Skipping gym plans.');
    await mongoose.connection.close();
    return;
  }

  const createdPlans = [];
  for (const p of GYM_PLANS) {
    const plan = await GymPlan.findOneAndUpdate(
      { subscriberId: admin.subscriberId, name: p.name },
      { ...p, subscriberId: admin.subscriberId },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    createdPlans.push(plan);
  }
  console.log(`✔ ${createdPlans.length} gym membership plans ready for subscriberId ${admin.subscriberId}`);

  const quarterlyGold = createdPlans.find((p) => p.name === 'Quarterly Gold');
  const member = await Member.findOne({ phone: MEMBER_PHONE });
  if (member && quarterlyGold) {
    member.planId = quarterlyGold._id;
    member.status = 'active';
    member.expiresAt = new Date(Date.now() + 12 * 24 * 60 * 60 * 1000); // 12 days out, for a realistic demo
    await member.save();
    console.log(`✔ Demo member subscribed to "${quarterlyGold.name}", expires ${member.expiresAt.toDateString()}`);
  }

  console.log('\nAll plan data is ready.');
  await mongoose.connection.close();
  process.exit(0);
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
