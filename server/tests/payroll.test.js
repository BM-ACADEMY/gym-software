const request = require('supertest');
const app = require('../app');
const db = require('./helpers/db');
const { createTenant, createSubAdmin } = require('./helpers/factories');
const SubAdmin = require('../models/SubAdmin');
const StaffAttendance = require('../models/StaffAttendance');
const StaffAdvance = require('../models/StaffAdvance');
const PayrollRun = require('../models/PayrollRun');

const auth = (t) => ({ Authorization: `Bearer ${t.adminToken}` });
const gym = () => createTenant({ subscriber: { trialEndsAt: new Date(Date.now() + 5 * 86400000) } });

describe('staff payroll', () => {
  beforeAll(async () => { await db.connect(); });
  afterAll(async () => { await db.clearDatabase(); await db.closeDatabase(); });

  const addStaff = async (t, salary, extra = {}) => {
    const s = await createSubAdmin(t.subscriber);
    const doc = s.subAdmin;
    await SubAdmin.updateOne({ _id: doc._id }, { $set: { baseSalary: salary, ...extra } });
    return doc;
  };

  test('draft run takes loss of pay from staff attendance and totals add up', async () => {
    const t = await gym();
    const a = await addStaff(t, 26000);
    const noSheet = await addStaff(t, 10000); // no attendance rows: no deduction
    for (let d = 1; d <= 24; d++) {
      await StaffAttendance.create({ subscriberId: t.subscriber._id, staffId: a._id, date: `2026-09-${String(d).padStart(2, '0')}`, status: 'present' });
    }
    const r = await request(app).post('/api/admin/payroll/runs').set(auth(t)).send({ month: '2026-09' });
    expect(r.status).toBe(201);
    const ia = r.body.data.items.find((i) => i.staffId === String(a._id));
    const ib = r.body.data.items.find((i) => i.staffId === String(noSheet._id));
    expect(ia.lopDays).toBe(2);
    expect(ia.payslip.net).toBe(24000);
    expect(ib.lopDays).toBe(0);
    expect(r.body.data.totals.net).toBe(34000);

    const dup = await request(app).post('/api/admin/payroll/runs').set(auth(t)).send({ month: '2026-09' });
    expect(dup.status).toBe(400);
  });

  test('PT commission from collected PT payments is added', async () => {
    const t = await gym();
    const trainer = await addStaff(t, 15000, { ptCommissionPercent: 20 });
    const Member = require('../models/Member');
    const Payment = require('../models/Payment');
    const m = await Member.create({ subscriberId: t.subscriber._id, name: 'M', phone: '9000000001', status: 'active', assignedSubAdminId: trainer._id });
    const p = await Payment.create({
      subscriberId: t.subscriber._id, memberId: m._id, amount: 5000, category: 'pt_session', method: 'cash', status: 'paid',
      installments: [{ amount: 5000, method: 'cash', paidAt: new Date('2026-08-10T10:00:00+05:30') }],
    });
    expect(p).toBeTruthy();
    const r = await request(app).post('/api/admin/payroll/runs').set(auth(t)).send({ month: '2026-08' });
    expect(r.status).toBe(201);
    expect(r.body.data.items[0].payslip.net).toBe(16000);
  });

  test('advances are recovered once, even if lock is repeated, and cannot exceed what is owed', async () => {
    const t = await gym();
    const s = await addStaff(t, 10000);
    const adv = await request(app).post('/api/admin/payroll/advances').set(auth(t)).send({ staffId: String(s._id), amount: 3000 });
    expect(adv.status).toBe(201);
    const run = await request(app).post('/api/admin/payroll/runs').set(auth(t)).send({ month: '2026-07' });
    expect(run.body.data.items[0].payslip.advanceApplied).toBe(3000);

    const tooMuch = await request(app).patch(`/api/admin/payroll/runs/${run.body.data._id}/items/${s._id}`).set(auth(t)).send({ advanceDue: 9000 });
    expect(tooMuch.status).toBe(400);
    const less = await request(app).patch(`/api/admin/payroll/runs/${run.body.data._id}/items/${s._id}`).set(auth(t)).send({ advanceDue: 1000 });
    expect(less.body.data.items[0].payslip.net).toBe(9000);

    await Promise.all([
      request(app).post(`/api/admin/payroll/runs/${run.body.data._id}/lock`).set(auth(t)),
      request(app).post(`/api/admin/payroll/runs/${run.body.data._id}/lock`).set(auth(t)),
    ]);
    await request(app).post(`/api/admin/payroll/runs/${run.body.data._id}/lock`).set(auth(t));
    const a = await StaffAdvance.findById(adv.body.data._id);
    expect(a.recovered).toBe(1000);

    const edit = await request(app).patch(`/api/admin/payroll/runs/${run.body.data._id}/items/${s._id}`).set(auth(t)).send({ lopDays: 1 });
    expect(edit.status).toBe(400);
    const del = await request(app).delete(`/api/admin/payroll/runs/${run.body.data._id}`).set(auth(t));
    expect(del.status).toBe(404);
  });

  test('payslip PDF downloads', async () => {
    const t = await gym();
    const s = await addStaff(t, 12000);
    const run = await request(app).post('/api/admin/payroll/runs').set(auth(t)).send({ month: '2026-06' });
    const pdf = await request(app).get(`/api/admin/payroll/runs/${run.body.data._id}/payslip/${s._id}`).set(auth(t)).buffer(true).parse((res, cb) => { const c = []; res.on('data', (d) => c.push(d)); res.on('end', () => cb(null, Buffer.concat(c))); });
    expect(pdf.status).toBe(200);
    expect(pdf.headers['content-type']).toMatch(/pdf/);
    expect(pdf.body.slice(0, 4).toString()).toBe('%PDF');
  });

  test('another gym cannot read, edit, lock or download this gym\'s payroll', async () => {
    const t = await gym();
    const other = await gym();
    const s = await addStaff(t, 12000);
    const run = await request(app).post('/api/admin/payroll/runs').set(auth(t)).send({ month: '2026-05' });
    const id = run.body.data._id;
    expect((await request(app).get(`/api/admin/payroll/runs/${id}`).set(auth(other))).status).toBe(404);
    expect((await request(app).patch(`/api/admin/payroll/runs/${id}/items/${s._id}`).set(auth(other)).send({ lopDays: 1 })).status).toBe(404);
    expect((await request(app).post(`/api/admin/payroll/runs/${id}/lock`).set(auth(other))).status).toBe(404);
    expect((await request(app).get(`/api/admin/payroll/runs/${id}/payslip/${s._id}`).set(auth(other))).status).toBe(404);
    expect((await request(app).patch(`/api/admin/payroll/staff/${s._id}`).set(auth(other)).send({ baseSalary: 1 })).status).toBe(404);
    expect((await request(app).post('/api/admin/payroll/advances').set(auth(other)).send({ staffId: String(s._id), amount: 100 })).status).toBe(404);
    expect((await request(app).get('/api/admin/payroll/runs').set(auth(other))).body.data).toHaveLength(0);
    expect(await PayrollRun.countDocuments({ subscriberId: other.subscriber._id })).toBe(0);
  });

  test('staff logins and gyms without the Accounts feature are refused; bad input is rejected', async () => {
    const t = await gym();
    const staffSession = await createSubAdmin(t.subscriber);
    expect([401, 403]).toContain((await request(app).get('/api/admin/payroll/runs').set({ Authorization: `Bearer ${staffSession.token}` })).status);

    const starter = await createTenant({ subscriber: { planKey: 'starter', billingCycle: 'monthly', paidUntil: new Date(Date.now() + 10 * 86400000) } });
    expect((await request(app).get('/api/admin/payroll/runs').set(auth(starter))).status).toBe(403);

    expect((await request(app).post('/api/admin/payroll/runs').set(auth(t)).send({ month: 'nope' })).status).toBe(400);
    expect((await request(app).post('/api/admin/payroll/runs').set(auth(t)).send({ month: '2026-04' })).status).toBe(400); // no salaried staff yet
    expect((await request(app).post('/api/admin/payroll/advances').set(auth(t)).send({ staffId: 'x', amount: 5 })).status).toBeGreaterThanOrEqual(400);
  });
});
