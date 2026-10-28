const request = require('supertest');
const app = require('../app');
const db = require('./helpers/db');
const { createTenant, createMember, createSubAdmin } = require('./helpers/factories');
const Attendance = require('../models/Attendance');
const StaffAttendance = require('../models/StaffAttendance');
const Member = require('../models/Member');
const SubAdmin = require('../models/SubAdmin');

const auth = (t) => ({ Authorization: `Bearer ${t.adminToken}` });

describe('device log import and staff attendance', () => {
  let t, member, staff;
  beforeAll(async () => {
    await db.connect();
    t = await createTenant();
    member = (await createMember(t.subscriber, { name: 'Ravi', deviceUserId: '101' })).member;
    staff = (await createSubAdmin(t.subscriber, {})).subAdmin;
    await SubAdmin.updateOne({ _id: staff._id }, { deviceUserId: '7' });
  });
  afterAll(async () => { await db.clearDatabase(); await db.closeDatabase(); });

  const rows = [
    { 'User ID': '101', 'Date/Time': '2026-12-01 06:00:10' },
    { 'User ID': '101', 'Date/Time': '2026-12-01 06:05:00' },
    { 'User ID': '101', 'Date/Time': '2026-12-02 06:00:00' },
    { 'User ID': '7', 'Date/Time': '2026-12-01 09:01:00' },
    { 'User ID': '7', 'Date/Time': '2026-12-01 18:10:00' },
    { 'User ID': '999', 'Date/Time': '2026-12-01 07:00:00' },
  ];

  test('preview counts without saving; commit saves; running again adds nothing', async () => {
    const prev = await request(app).post('/api/admin/attendance/device-log').set(auth(t)).send({ rows, commit: false });
    expect(prev.status).toBe(200);
    expect(prev.body.data.memberCheckIns).toBe(2);
    expect(prev.body.data.repeatPunches).toBe(1);
    expect(prev.body.data.staffDays).toBe(1);
    expect(prev.body.data.unmatchedIds).toEqual([{ userId: '999', punches: 1 }]);
    expect(await Attendance.countDocuments({ subscriberId: t.subscriber._id })).toBe(0);

    const done = await request(app).post('/api/admin/attendance/device-log').set(auth(t)).send({ rows, commit: true });
    expect(done.status).toBe(201);
    expect(await Attendance.countDocuments({ subscriberId: t.subscriber._id, method: 'biometric' })).toBe(2);
    const day = await StaffAttendance.findOne({ subscriberId: t.subscriber._id, staffId: staff._id, date: '2026-12-01' });
    expect(day.status).toBe('present');
    expect(day.outAt).toBeTruthy();

    const again = await request(app).post('/api/admin/attendance/device-log').set(auth(t)).send({ rows, commit: true });
    expect(again.body.data.memberCheckIns).toBe(0);
    expect(again.body.data.alreadyRecorded).toBe(2);
    expect(await Attendance.countDocuments({ subscriberId: t.subscriber._id })).toBe(2);
  });

  test('never matches another gym\'s member with the same device ID', async () => {
    const other = await createTenant();
    await createMember(other.subscriber, { name: 'Other', deviceUserId: '555' });
    const r = await request(app).post('/api/admin/attendance/device-log').set(auth(t)).send({ rows: [{ 'User ID': '555', 'Date/Time': '2026-12-03 06:00:00' }], commit: true });
    expect(r.body.data.memberCheckIns).toBe(0);
    expect(r.body.data.unmatchedCount).toBe(1);
  });

  test('staff attendance: mark leave, list the day, month totals, bad input refused', async () => {
    const put = await request(app).put('/api/admin/staff-attendance').set(auth(t)).send({ staffId: String(staff._id), date: '2026-12-02', status: 'leave' });
    expect(put.status).toBe(200);
    const list = await request(app).get('/api/admin/staff-attendance?date=2026-12-02').set(auth(t));
    expect(list.body.data.staff[0].record.status).toBe('leave');
    const month = await request(app).get('/api/admin/staff-attendance/month?month=2026-12').set(auth(t));
    const mine = month.body.data.rows.find((r) => String(r.id) === String(staff._id));
    expect(mine.present).toBe(1);
    expect(mine.leave).toBe(1);
    expect((await request(app).put('/api/admin/staff-attendance').set(auth(t)).send({ staffId: String(staff._id), date: '2999-01-01', status: 'present' })).status).toBe(400);
    expect((await request(app).put('/api/admin/staff-attendance').set(auth(t)).send({ staffId: String(staff._id), date: '2026-12-02', status: 'holiday' })).status).toBe(400);
    const otherGym = await createTenant();
    expect((await request(app).put('/api/admin/staff-attendance').set(auth(otherGym)).send({ staffId: String(staff._id), date: '2026-12-02', status: 'present' })).status).toBe(404);
  });
});
