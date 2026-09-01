// One-off / re-runnable seed for the four demo login accounts (one per role).
// Usage: node scripts/seedDemoUsers.js
require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const connectDB = require('../config/db');
const RootAdmin = require('../models/RootAdmin');
const Subscriber = require('../models/Subscriber');
const Admin = require('../models/Admin');
const SubAdmin = require('../models/SubAdmin');
const Member = require('../models/Member');

const ROOT_ADMIN = { name: 'Snega', phone: '7339017112', password: 'Snega@123' };
const OWNER = { name: 'Charles', phone: '8807226257', password: 'Charles@123', gymName: "Charles' Gym" };
const SUB_ADMIN = { name: 'Swetha', phone: '9345989654', password: 'Swetha@123' };
const MEMBER = { name: 'Ragu', phone: '9486788591', password: 'Ragu@123' };

const hash = (plain) => bcrypt.hash(plain, 10);

async function seed() {
  await connectDB();

  // 1. Root Admin
  const rootPasswordHash = await hash(ROOT_ADMIN.password);
  await RootAdmin.findOneAndUpdate(
    { phone: ROOT_ADMIN.phone },
    {
      name: ROOT_ADMIN.name,
      phone: ROOT_ADMIN.phone,
      passwordHash: rootPasswordHash,
      role: 'root_admin',
      status: 'approved',
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  console.log(`✔ Root Admin ready — phone: ${ROOT_ADMIN.phone}`);

  // 2. Gym Owner (Admin) — reuse their Subscriber if the account already exists,
  // otherwise create a fresh gym for them.
  let admin = await Admin.findOne({ phone: OWNER.phone });
  let subscriberId = admin?.subscriberId;

  if (!subscriberId) {
    const subscriber = await Subscriber.create({ gymName: OWNER.gymName, isActive: true });
    subscriberId = subscriber._id;
  }

  const ownerPasswordHash = await hash(OWNER.password);
  admin = await Admin.findOneAndUpdate(
    { phone: OWNER.phone },
    {
      subscriberId,
      name: OWNER.name,
      phone: OWNER.phone,
      passwordHash: ownerPasswordHash,
      role: 'admin',
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  console.log(`✔ Gym Owner ready — phone: ${OWNER.phone}, subscriberId: ${subscriberId}`);

  // 3. Sub-Admin (Staff) — belongs to the same gym, full trainer-style access by default.
  const subAdminPasswordHash = await hash(SUB_ADMIN.password);
  await SubAdmin.findOneAndUpdate(
    { subscriberId, phone: SUB_ADMIN.phone },
    {
      subscriberId,
      name: SUB_ADMIN.name,
      phone: SUB_ADMIN.phone,
      passwordHash: subAdminPasswordHash,
      role: 'subadmin',
      template: 'trainer',
      permissions: {
        dashboard: { view: true, edit: false },
        members: { view: true, edit: true },
        attendance: { view: true, edit: true },
        earnings: { view: true, edit: false },
        'pt-sessions': { view: true, edit: true },
        workout: { view: true, edit: true },
        settings: { view: true, edit: true },
      },
      isActive: true,
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  console.log(`✔ Sub-Admin ready — phone: ${SUB_ADMIN.phone}`);

  // 4. Member (Customer) — belongs to the same gym.
  const memberPasswordHash = await hash(MEMBER.password);
  await Member.findOneAndUpdate(
    { subscriberId, phone: MEMBER.phone },
    {
      subscriberId,
      name: MEMBER.name,
      phone: MEMBER.phone,
      passwordHash: memberPasswordHash,
      status: 'active',
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  console.log(`✔ Member ready — phone: ${MEMBER.phone}`);

  console.log('\nAll demo accounts are ready.');
  await mongoose.connection.close();
  process.exit(0);
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
