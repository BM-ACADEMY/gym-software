// RM-10 business rule (D-32 rule 10, Kamarudeen 25 Nov): a deleted gym stays 30 days in Root Admin's
// deleted list, closed to its users; Root Admin can restore it or delete it for good; after 30 days it goes by itself.
const request = require('supertest');
const app = require('../app');
const db = require('./helpers/db');
const { createTenant, createMember, createRootAdmin } = require('./helpers/factories');
const { purgeExpired } = require('../services/gymBin');
const Subscriber = require('../models/Subscriber');
const Member = require('../models/Member');
const Lead = require('../models/Lead');
const AuditLog = require('../models/AuditLog');

const DAY = 86400000;
const bearer = (token) => ({ Authorization: `Bearer ${token}` });

describe('deleted gyms are kept 30 days (RM-10, ROOT-04)', () => {
  let root;
  beforeAll(async () => { await db.connect(); root = (await createRootAdmin()).token; });
  afterAll(async () => { await db.clearDatabase(); await db.closeDatabase(); });

  const api = (method, path) => request(app)[method](`/api/root-admin/subscribers${path}`).set(bearer(root));

  test('delete closes the gym to its users but keeps every record; it shows only in the deleted list', async () => {
    const t = await createTenant();
    const { token: memberToken } = await createMember(t.subscriber, { name: 'Ravi' });
    const r = await api('delete', `/${t.subscriber._id}`);
    expect(r.status).toBe(200); expect(r.body.data.purgeAt).toBeTruthy();
    expect(await Member.countDocuments({ subscriberId: t.subscriber._id })).toBe(1);
    expect((await request(app).get('/api/admin/members').set(bearer(t.adminToken))).status).toBe(403);
    expect((await request(app).get('/api/member/dashboard').set(bearer(memberToken))).status).toBe(403);
    const ids = (res) => res.body.data.map((s) => String(s._id));
    expect(ids(await api('get', '/'))).not.toContain(String(t.subscriber._id));
    expect(ids(await api('get', '/?status=deleted'))).toContain(String(t.subscriber._id));
    expect((await api('patch', `/${t.subscriber._id}/activate`)).status).toBe(400);
    expect((await api('post', `/${t.subscriber._id}/impersonate`)).status).toBe(400);
  });

  test('restore brings the gym back as it was, suspended or not', async () => {
    const active = await createTenant(); const suspended = await createTenant({ subscriber: { isActive: false } });
    for (const t of [active, suspended]) {
      await api('delete', `/${t.subscriber._id}`);
      expect((await api('post', `/${t.subscriber._id}/restore`)).status).toBe(200);
    }
    expect((await Subscriber.findById(active.subscriber._id)).isActive).toBe(true);
    expect((await Subscriber.findById(suspended.subscriber._id)).isActive).toBe(false);
    expect((await Subscriber.findById(active.subscriber._id)).deletedAt).toBeNull();
    expect((await request(app).get('/api/admin/members').set(bearer(active.adminToken))).status).toBe(200);
  });

  test('delete for good works only from the deleted list and removes the gym data, leads included', async () => {
    const t = await createTenant();
    await createMember(t.subscriber, {});
    await Lead.create({ subscriberId: t.subscriber._id, name: 'Enquiry', phone: '9123456780' });
    expect((await api('delete', `/${t.subscriber._id}/permanent`)).status).toBe(400); // not in the list yet
    await api('delete', `/${t.subscriber._id}`);
    expect((await api('delete', `/${t.subscriber._id}/permanent`)).status).toBe(200);
    expect(await Subscriber.exists({ _id: t.subscriber._id })).toBeNull();
    expect(await Member.countDocuments({ subscriberId: t.subscriber._id })).toBe(0);
    expect(await Lead.countDocuments({ subscriberId: t.subscriber._id })).toBe(0);
    expect(await AuditLog.exists({ subscriberId: t.subscriber._id, action: 'delete' })).toBeTruthy();
  });

  test('after 30 days the gym is deleted for good by itself; before that it stays', async () => {
    const old = await createTenant(); const recent = await createTenant();
    await api('delete', `/${old.subscriber._id}`); await api('delete', `/${recent.subscriber._id}`);
    await Subscriber.updateOne({ _id: old.subscriber._id }, { $set: { deletedAt: new Date(Date.now() - 31 * DAY) } });
    await Subscriber.updateOne({ _id: recent.subscriber._id }, { $set: { deletedAt: new Date(Date.now() - 29 * DAY) } });
    expect(await purgeExpired()).toBe(1);
    expect(await Subscriber.exists({ _id: old.subscriber._id })).toBeNull();
    expect(await Subscriber.exists({ _id: recent.subscriber._id })).toBeTruthy();
    expect(await AuditLog.exists({ subscriberId: old.subscriber._id, action: 'delete_after_30_days' })).toBeTruthy();
  });

  test('only the Root Admin can delete, restore or delete for good; unknown or bad ids are not found', async () => {
    const t = await createTenant();
    expect((await request(app).delete(`/api/root-admin/subscribers/${t.subscriber._id}`).set(bearer(t.adminToken))).status).toBe(403);
    expect((await request(app).post(`/api/root-admin/subscribers/${t.subscriber._id}/restore`).set(bearer(t.adminToken))).status).toBe(403);
    expect((await api('delete', '/000000000000000000000000')).status).toBe(404);
    expect((await api('post', '/not-an-id/restore')).status).toBe(404);
    expect((await Subscriber.findById(t.subscriber._id)).deletedAt).toBeNull();
  });
});
