// Fixture builders shared across test files — direct model creation (not
// HTTP signup) since these tests are about authorization/isolation behavior,
// not the signup flow itself. Tokens are minted directly with the same
// generateToken() the real login endpoints use.
const bcrypt = require('bcryptjs');
const Subscriber = require('../../models/Subscriber');
const Admin = require('../../models/Admin');
const SubAdmin = require('../../models/SubAdmin');
const Member = require('../../models/Member');
const RootAdmin = require('../../models/RootAdmin');
const { generateToken } = require('../../utils/jwt');

let counter = 0;
const unique = (prefix) => `${prefix}${Date.now()}${counter++}`;

const createTenant = async (overrides = {}) => {
  const subscriber = await Subscriber.create({ gymName: overrides.gymName || unique('Gym '), ...overrides.subscriber });
  const admin = await Admin.create({
    subscriberId: subscriber._id,
    name: overrides.adminName || 'Test Owner',
    phone: unique('9'),
    passwordHash: await bcrypt.hash('password123', 10),
    ...overrides.admin,
  });
  return { subscriber, admin, adminToken: generateToken({ id: admin._id, role: 'admin', subscriberId: subscriber._id }) };
};

const createSubAdmin = async (subscriber, permissions = {}, overrides = {}) => {
  const subAdmin = await SubAdmin.create({
    subscriberId: subscriber._id,
    name: overrides.name || 'Test Staff',
    phone: unique('8'),
    passwordHash: await bcrypt.hash('password123', 10),
    permissions,
    isActive: overrides.isActive !== undefined ? overrides.isActive : true,
    ...overrides,
  });
  return { subAdmin, token: generateToken({ id: subAdmin._id, role: 'subadmin', subscriberId: subscriber._id }) };
};

const createMember = async (subscriber, overrides = {}) => {
  const member = await Member.create({
    subscriberId: subscriber._id,
    name: overrides.name || 'Test Member',
    phone: unique('7'),
    status: 'active',
    ...overrides,
  });
  return { member, token: generateToken({ id: member._id, role: 'member', subscriberId: subscriber._id }) };
};

const createRootAdmin = async (overrides = {}) => {
  const rootAdmin = await RootAdmin.create({
    name: overrides.name || 'Test Root',
    email: unique('root') + '@test.com',
    passwordHash: await bcrypt.hash('password123', 10),
    status: 'approved',
    ...overrides,
  });
  return { rootAdmin, token: generateToken({ id: rootAdmin._id, role: 'root_admin' }) };
};

module.exports = { createTenant, createSubAdmin, createMember, createRootAdmin, unique };
