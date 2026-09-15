const request = require('supertest');
const app = require('../app');
const db = require('./helpers/db');
const { createTenant, createSubAdmin, createMember } = require('./helpers/factories');

// permissionGuard + each controller's own getSubAdminScope() together form the
// doc's RBAC rule: a sub-admin needs `view`/`edit` on a module at all, and
// without `viewAll` is further restricted to only their own assigned members.
describe('Sub-admin permission matrix', () => {
  let gym, memberOwn, memberOther;

  beforeAll(async () => {
    await db.connect();
    gym = await createTenant({ gymName: 'Permission Gym' });
  });

  afterAll(async () => {
    await db.clearDatabase();
    await db.closeDatabase();
  });

  test('sub-admin with no "members" permission entry at all is rejected (403)', async () => {
    const { token } = await createSubAdmin(gym.subscriber, {});
    const res = await request(app)
      .get('/api/subadmin/members')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  test('sub-admin with view:false on "members" is rejected even if edit:true', async () => {
    const { token } = await createSubAdmin(gym.subscriber, { members: { view: false, edit: true, viewAll: true } });
    const res = await request(app)
      .get('/api/subadmin/members')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  test('sub-admin with view:true, edit:false on "members" can read but cannot create', async () => {
    const { token } = await createSubAdmin(gym.subscriber, { members: { view: true, edit: false, viewAll: true } });
    const readRes = await request(app)
      .get('/api/subadmin/members')
      .set('Authorization', `Bearer ${token}`);
    expect(readRes.status).toBe(200);

    const writeRes = await request(app)
      .post('/api/subadmin/members')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Should Not Be Created' });
    expect(writeRes.status).toBe(403);
  });

  test('a deactivated (isActive:false) sub-admin is rejected regardless of permissions', async () => {
    const { token } = await createSubAdmin(gym.subscriber, { members: { view: true, edit: true, viewAll: true } }, { isActive: false });
    const res = await request(app)
      .get('/api/subadmin/members')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  test('viewAll:false scopes a sub-admin to only their own assigned members', async () => {
    const { subAdmin, token } = await createSubAdmin(gym.subscriber, { members: { view: true, edit: true, viewAll: false } });
    memberOwn = (await createMember(gym.subscriber, { name: 'Owned Member', assignedSubAdminId: subAdmin._id })).member;
    memberOther = (await createMember(gym.subscriber, { name: 'Unowned Member' })).member;

    const listRes = await request(app)
      .get('/api/subadmin/members')
      .set('Authorization', `Bearer ${token}`);
    const names = listRes.body.data.members.map((m) => m.name);
    expect(names).toContain('Owned Member');
    expect(names).not.toContain('Unowned Member');

    const getOtherRes = await request(app)
      .get(`/api/subadmin/members/${memberOther._id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(getOtherRes.status).toBe(404);

    const getOwnRes = await request(app)
      .get(`/api/subadmin/members/${memberOwn._id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(getOwnRes.status).toBe(200);
  });

  test('viewAll:true lets a sub-admin see members not assigned to them', async () => {
    const { token } = await createSubAdmin(gym.subscriber, { members: { view: true, edit: true, viewAll: true } });
    const listRes = await request(app)
      .get('/api/subadmin/members')
      .set('Authorization', `Bearer ${token}`);
    const names = listRes.body.data.members.map((m) => m.name);
    expect(names).toContain('Owned Member');
    expect(names).toContain('Unowned Member');
  });

  test('a permission granted on one module does not leak into another (attendance permission does not unlock members)', async () => {
    const { token } = await createSubAdmin(gym.subscriber, { attendance: { view: true, edit: true, viewAll: true } });
    const res = await request(app)
      .get('/api/subadmin/members')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  test('the Gym Owner (admin role) always has full access regardless of any permissions map', async () => {
    const res = await request(app)
      .get('/api/admin/members')
      .set('Authorization', `Bearer ${gym.adminToken}`);
    expect(res.status).toBe(200);
  });
});
