const request = require('supertest');
const app = require('../app');
const db = require('./helpers/db');
const { createTenant, createMember } = require('./helpers/factories');
const GymClass = require('../models/GymClass');
const ClassBooking = require('../models/ClassBooking');
const Notification = require('../models/Notification');

const adm = (t) => ({ Authorization: `Bearer ${t.adminToken}` });
const mem = (m) => ({ Authorization: `Bearer ${m.token}` });
const soon = () => new Date(Date.now() + 86400000).toISOString();

describe('class booking with waitlist', () => {
  beforeAll(async () => { await db.connect(); });
  afterAll(async () => { await db.clearDatabase(); await db.closeDatabase(); });

  const setup = async (capacity = 1) => {
    const t = await createTenant({ subscriber: { trialEndsAt: new Date(Date.now() + 5 * 86400000) } });
    const res = await request(app).post('/api/admin/classes').set(adm(t)).send({ name: 'Zumba', startsAt: soon(), capacity });
    expect(res.status).toBe(201);
    return { t, cls: res.body.data };
  };

  test('first member gets the seat, second goes to the waitlist, cancel promotes the waitlisted one', async () => {
    const { t, cls } = await setup(1);
    const a = await createMember(t.subscriber);
    const b = await createMember(t.subscriber);
    const ra = await request(app).post(`/api/member/classes/${cls._id}/book`).set(mem(a));
    const rb = await request(app).post(`/api/member/classes/${cls._id}/book`).set(mem(b));
    expect(ra.body.data.status).toBe('booked');
    expect(rb.body.data.status).toBe('waitlist');

    const dup = await request(app).post(`/api/member/classes/${cls._id}/book`).set(mem(a));
    expect(dup.status).toBe(409);

    const cancel = await request(app).delete(`/api/member/classes/bookings/${ra.body.data._id}`).set(mem(a));
    expect(cancel.status).toBe(200);
    expect((await ClassBooking.findById(rb.body.data._id)).status).toBe('booked');
    expect((await GymClass.findById(cls._id)).bookedCount).toBe(1);
    expect(await Notification.countDocuments({ recipientId: b.member._id, type: 'class_waitlist_promoted' })).toBe(1);
  });

  test('seat count is freed when nobody is waiting, and rebooking works', async () => {
    const { t, cls } = await setup(1);
    const a = await createMember(t.subscriber);
    const r = await request(app).post(`/api/member/classes/${cls._id}/book`).set(mem(a));
    await request(app).delete(`/api/member/classes/bookings/${r.body.data._id}`).set(mem(a));
    expect((await GymClass.findById(cls._id)).bookedCount).toBe(0);
    const again = await request(app).post(`/api/member/classes/${cls._id}/book`).set(mem(a));
    expect(again.body.data.status).toBe('booked');
  });

  test('ten people race for 3 seats: exactly 3 booked', async () => {
    const { t, cls } = await setup(3);
    const ms = await Promise.all(Array.from({ length: 10 }, () => createMember(t.subscriber)));
    const rs = await Promise.all(ms.map((m) => request(app).post(`/api/member/classes/${cls._id}/book`).set(mem(m))));
    const booked = rs.filter((r) => r.body.data?.status === 'booked').length;
    expect(booked).toBe(3);
    expect((await GymClass.findById(cls._id)).bookedCount).toBe(3);
  });

  test('expired or frozen members cannot book', async () => {
    const { t, cls } = await setup(2);
    const exp = await createMember(t.subscriber, { status: 'active', expiresAt: new Date(Date.now() - 86400000) });
    const froz = await createMember(t.subscriber, { status: 'frozen' });
    expect((await request(app).post(`/api/member/classes/${cls._id}/book`).set(mem(exp))).status).toBe(403);
    expect((await request(app).post(`/api/member/classes/${cls._id}/book`).set(mem(froz))).status).toBe(403);
  });

  test('another gym cannot see, book or cancel this gym\'s classes', async () => {
    const { t, cls } = await setup(2);
    const other = await createTenant({ subscriber: { trialEndsAt: new Date(Date.now() + 5 * 86400000) } });
    const outsider = await createMember(other.subscriber);
    const own = await createMember(t.subscriber);
    const r = await request(app).post(`/api/member/classes/${cls._id}/book`).set(mem(own));

    expect((await request(app).post(`/api/member/classes/${cls._id}/book`).set(mem(outsider))).status).toBe(404);
    expect((await request(app).get(`/api/admin/classes/${cls._id}/bookings`).set(adm(other))).status).toBe(404);
    expect((await request(app).patch(`/api/admin/classes/${cls._id}/cancel`).set(adm(other))).status).toBe(404);
    expect((await request(app).delete(`/api/admin/classes/${cls._id}/bookings/${r.body.data._id}`).set(adm(other))).status).toBe(404);
    const list = await request(app).get('/api/member/classes').set(mem(outsider));
    expect(list.body.data).toHaveLength(0);
  });

  test('a member cannot cancel someone else\'s booking', async () => {
    const { t, cls } = await setup(2);
    const a = await createMember(t.subscriber);
    const b = await createMember(t.subscriber);
    const r = await request(app).post(`/api/member/classes/${cls._id}/book`).set(mem(a));
    expect((await request(app).delete(`/api/member/classes/bookings/${r.body.data._id}`).set(mem(b))).status).toBe(404);
  });

  test('owner cancelling a class releases everyone and notifies them; past start time is refused', async () => {
    const { t, cls } = await setup(2);
    const a = await createMember(t.subscriber);
    await request(app).post(`/api/member/classes/${cls._id}/book`).set(mem(a));
    const c = await request(app).patch(`/api/admin/classes/${cls._id}/cancel`).set(adm(t));
    expect(c.status).toBe(200);
    expect(await ClassBooking.countDocuments({ classId: cls._id, status: { $in: ['booked', 'waitlist'] } })).toBe(0);
    expect(await Notification.countDocuments({ recipientId: a.member._id, type: 'class_cancelled' })).toBe(1);
    expect((await request(app).post(`/api/member/classes/${cls._id}/book`).set(mem(a))).status).toBe(404);

    const past = await request(app).post('/api/admin/classes').set(adm(t)).send({ name: 'Old', startsAt: new Date(Date.now() - 1000).toISOString(), capacity: 5 });
    expect(past.status).toBe(400);
    const badCap = await request(app).post('/api/admin/classes').set(adm(t)).send({ name: 'X', startsAt: soon(), capacity: 0 });
    expect(badCap.status).toBe(400);
  });

  test('staff books on behalf of a member; admin list shows waitlist counts', async () => {
    const { t, cls } = await setup(1);
    const a = await createMember(t.subscriber);
    const b = await createMember(t.subscriber);
    await request(app).post(`/api/admin/classes/${cls._id}/bookings`).set(adm(t)).send({ memberId: String(a.member._id) });
    await request(app).post(`/api/admin/classes/${cls._id}/bookings`).set(adm(t)).send({ memberId: String(b.member._id) });
    const list = await request(app).get('/api/admin/classes').set(adm(t));
    const row = list.body.data.find((c) => c._id === cls._id);
    expect(row.waitlistCount).toBe(1);
    expect(row.bookedCount).toBe(1);
  });
});
