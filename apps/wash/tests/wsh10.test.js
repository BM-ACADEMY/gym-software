const fs = require('fs'); const os = require('os'); const path = require('path');
const { createWashRouter } = require('../src/routes'); const { makeFakeModels } = require('./fakeModels');
const ST = require('../src/storage'); const PAY = require('../src/payroll'); const R = require('../src/reports'); const BAYS = require('../src/bays'); const { jobCardHtml } = require('../src/jobCard');
const T1 = 'aaaaaaaaaaaaaaaaaaaaaaa1', T2 = 'aaaaaaaaaaaaaaaaaaaaaaa2';
const mem = () => { const files = {}; return { kind: 'mem', files, put: async (k, b) => { files[k] = b; }, get: async (k) => files[k] || null, remove: async (k) => { delete files[k]; } }; };
function harness(opts = {}) {
  const h = {}; const router = { use: () => {}, get: (p, ...f) => (h['GET ' + p] = f), post: (p, ...f) => (h['POST ' + p] = f), put: (p, ...f) => (h['PUT ' + p] = f) };
  const M = makeFakeModels(); const clock = new Date('2026-11-12T08:00:00Z'); const photoStore = opts.store === undefined ? mem() : opts.store;
  createWashRouter({ express: { Router: () => router }, models: M, protect: 'P', authorize: () => 'A', tenantOf: (req) => req.user.tenantId, planOf: () => 'growth', now: () => clock, photoStore });
  const call = async (key, tenant, { body = {}, query = {}, params = {}, role = 'admin', headers = {} } = {}) => {
    const o = { h: {} }; const req = { user: { id: 'u', tenantId: tenant, role }, body, query, params, headers };
    const res = { set: (k, v) => { o.h[k] = v; }, send: (b) => { o.text = b; if (!o.c) o.c = 200; }, status(c) { o.c = c; return this; }, json(b) { o.b = b; if (!o.c) o.c = 200; } };
    const chain = h[key]; if (!chain) throw new Error('no route ' + key); for (let i = 0; i < chain.length; i++) { let went = false; await chain[i](req, res, () => { went = true; }); if (!went) break; }
    return o;
  };
  return { call, M, store: photoStore };
}
const seed = async (H, t = T1) => { await H.M.Tenant.create({ _id: t, businessName: 'Sparkle <b>Wash</b>' }); await H.M.PriceList.create({ tenantId: t, prices: { sedan: 400, suv: 600 }, addons: { wax: 150 } }); };
const JPG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(40, 1)]);
const withJob = async (H, t = T1, extra = {}) => H.M.Job.create({ tenantId: t, number: 1, plate: 'TN09AB1234', klass: 'sedan', day: '2026-11-12', state: 'delivered', total: 400, payments: [{ method: 'cash', amount: 400 }], lines: [{ key: 'sedan', amount: 400 }], ...extra });

describe('bay', () => {
  test('rules: short label, letters digits space dash, empty clears', () => {
    expect(BAYS.checkBay('Bay 1').value).toBe('Bay 1'); expect(BAYS.checkBay('').value).toBeUndefined(); expect(BAYS.checkBay('<b>').error).toBeTruthy(); expect(BAYS.checkBay('x'.repeat(13)).error).toBeTruthy(); expect(BAYS.checkBay(5).error).toBeTruthy();
  });
  test('a new job can carry a bay; bay can be changed until the job is finished; another business cannot touch it', async () => {
    const H = harness(); await seed(H); await H.M.Vehicle.create({ tenantId: T1, plate: 'TN09AB1234', klass: 'sedan' });
    expect((await H.call('POST /jobs', T1, { body: { plate: 'TN09AB1234', bay: '<x>' } })).c).toBe(400);
    const j = await H.call('POST /jobs', T1, { body: { plate: 'TN09AB1234', bay: 'Bay 2' } }); expect(j.c).toBe(201); expect(j.b.data.bay).toBe('Bay 2');
    const id = String(j.b.data._id);
    expect((await H.call('POST /jobs/:id/bay', T1, { params: { id }, body: { bay: 'Bay 3' } })).b.data.bay).toBe('Bay 3');
    expect((await H.call('POST /jobs/:id/bay', T2, { params: { id }, body: { bay: 'Bay 1' } })).c).toBe(404);
    expect((await H.call('POST /jobs/:id/bay', T1, { params: { id }, body: { bay: '$$' } })).c).toBe(400);
    await H.M.Job.updateOne({ _id: id }, { $set: { state: 'delivered' } }); expect((await H.call('POST /jobs/:id/bay', T1, { params: { id }, body: { bay: 'A' } })).c).toBe(409);
  });
});
describe('booking QR and booking to job', () => {
  test('QR: owner only, own token, SVG, uses the public address; another business gets a different one', async () => {
    const H = harness(); await seed(H); await seed(H, T2); const hd = { headers: { host: 'wash.example.in' } };
    expect((await H.call('GET /booking-link/qr.svg', T1, { role: 'subadmin', ...hd })).c).toBe(403);
    const a = await H.call('GET /booking-link/qr.svg', T1, hd); expect(a.c).toBe(200); expect(a.h['Content-Type']).toMatch(/svg/); expect(a.text.startsWith('<svg')).toBe(true); expect(a.h['Cache-Control']).toBe('no-store');
    const b = await H.call('GET /booking-link/qr.svg', T2, hd); expect(b.text === a.text).toBe(false);
    const t1 = H.M.Tenant.rows.find((r) => String(r._id) === T1); expect(t1.bookingToken).toMatch(/^[0-9a-f]{48}$/);
    expect((await H.call('GET /booking-link/qr.svg', T1, { headers: { host: 'bad host/<x>' } })).c).toBe(400);
  });
  test('convert: owner only, own requests only, once only, price from the list, phone not copied to the vehicle', async () => {
    const H = harness(); await seed(H); await seed(H, T2);
    const bk = await H.M.Booking.create({ tenantId: T1, name: 'Anu', phone: '9876543210', plate: 'TN09AB1234', klass: 'sedan', day: '2026-11-13', slot: '10:00', status: 'new' });
    const id = String(bk._id);
    expect((await H.call('POST /bookings/:id/convert', T1, { params: { id }, role: 'subadmin' })).c).toBe(403);
    expect((await H.call('POST /bookings/:id/convert', T2, { params: { id } })).c).toBe(404);
    expect((await H.call('POST /bookings/:id/convert', T1, { params: { id }, body: { bay: '<x>' } })).c).toBe(400);
    const ok = await H.call('POST /bookings/:id/convert', T1, { params: { id }, body: { bay: 'A' } }); expect(ok.c).toBe(201);
    const job = H.M.Job.rows[0]; expect(job.total).toBe(400); expect(job.plate).toBe('TN09AB1234'); expect(job.bay).toBe('A'); expect(job.tenantId).toBe(T1); expect(job.state).toBe('waiting');
    const v = H.M.Vehicle.rows[0]; expect(v.plate).toBe('TN09AB1234'); expect(v.ownerPhone).toBeUndefined(); expect(v.ownerName).toBeUndefined();
    const row = H.M.Booking.rows[0]; expect(row.status).toBe('converted'); expect(String(row.jobId)).toBe(String(job._id));
    expect((await H.call('POST /bookings/:id/convert', T1, { params: { id } })).c).toBe(409); expect(H.M.Job.rows.length).toBe(1);
    expect(H.M.Audit.rows.some((r) => r.action === 'booking.convert')).toBe(true);
  });
  test('convert: no plate or no price is refused and the request stays open; a declined request cannot be converted', async () => {
    const H = harness(); await seed(H);
    const a = await H.M.Booking.create({ tenantId: T1, name: 'Anu', phone: '9876543210', day: '2026-11-13', slot: '10:00', status: 'new' });
    expect((await H.call('POST /bookings/:id/convert', T1, { params: { id: String(a._id) } })).c).toBe(400);
    expect((await H.call('POST /bookings/:id/convert', T1, { params: { id: String(a._id) }, body: { plate: 'TN09AB1234' } })).c).toBe(400); // no class
    expect(H.M.Booking.rows[0].status).toBe('new');
    const d = await H.M.Booking.create({ tenantId: T1, name: 'B', phone: '9876543211', plate: 'TN09AB1235', klass: 'suv', day: '2026-11-13', slot: '11:00', status: 'declined' });
    expect((await H.call('POST /bookings/:id/convert', T1, { params: { id: String(d._id) } })).c).toBe(409);
  });
});
describe('pay advances and deductions', () => {
  test('rules: deduction needs a reason; whole rupees; payslip never goes below zero and carries the rest', () => {
    expect(PAY.checkAdjust({ kind: 'deduction', amount: 100, note: 'ab' }).error).toBeTruthy(); expect(PAY.checkAdjust({ kind: 'advance', amount: 1.5 }).error).toBeTruthy(); expect(PAY.checkAdjust({ kind: 'gift', amount: 5 }).error).toBeTruthy();
    const s = PAY.payslip({ month: '2026-11', name: 'R', monthlySalary: 3000, att: { present: 30 }, advances: 2500, deductions: 700 }); expect(s.gross).toBe(3000); expect(s.net).toBe(0); expect(s.carryForward).toBe(200);
    expect(PAY.payslip({ month: '2026-11', name: 'R', monthlySalary: 3000, att: { present: 30 } }).net).toBe(3000);
  });
  test('routes: owner only, own attendants only, named or by id, shown on the payslip, listed for the month', async () => {
    const H = harness(); const a = await H.M.Attendant.create({ tenantId: T1, name: 'Ravi', monthlySalary: 15000, isActive: true }); await H.M.Attendant.create({ tenantId: T2, name: 'Ravi', monthlySalary: 15000, isActive: true });
    const post = (t, body, role) => H.call('POST /pay-adjustments', t, { body, role });
    expect((await post(T1, { attendant: 'Ravi', kind: 'advance', amount: 2000 }, 'subadmin')).c).toBe(403);
    expect((await post(T1, { attendant: 'Ravi', kind: 'deduction', amount: 300 })).c).toBe(400);
    expect((await post(T1, { attendant: 'Nobody', kind: 'advance', amount: 100 })).c).toBe(404);
    expect((await post(T1, { attendant: 'Ravi', kind: 'advance', amount: 2000, day: '2027-01-01' })).c).toBe(400);
    expect((await post(T1, { attendant: 'Ravi', kind: 'advance', amount: 2000, day: '2026-11-05' })).c).toBe(201);
    expect((await post(T1, { attendantId: String(a._id), kind: 'deduction', amount: 300, note: 'broke a bucket' })).c).toBe(201);
    const slip = (await H.call('GET /payslips', T1, { query: { month: '2026-11' } })).b.data.slips[0]; expect(slip.advances).toBe(2000); expect(slip.deductions).toBe(300); expect(slip.net).toBe(slip.gross - 2300); expect(slip.words).toMatch(/Advance taken Rs 2000/);
    expect((await H.call('GET /payslips', T2, { query: { month: '2026-11' } })).b.data.slips[0].advances).toBe(0);
    expect((await H.call('GET /pay-adjustments', T1, { query: { month: '2026-11' } })).b.data.length).toBe(2); expect((await H.call('GET /pay-adjustments', T2, { query: { month: '2026-11' } })).b.data.length).toBe(0);
    expect((await H.call('GET /pay-adjustments', T1, { role: 'subadmin' })).c).toBe(403);
    await H.M.Attendant.create({ tenantId: T1, name: 'Ravi', isActive: true }); expect((await post(T1, { attendant: 'Ravi', kind: 'advance', amount: 10 })).c).toBe(409);
  });
  test('shifts can be entered with a typed name; the list shows names; another business sees nothing', async () => {
    const H = harness(); await H.M.Attendant.create({ tenantId: T1, name: 'Ravi', isActive: true });
    expect((await H.call('POST /shifts', T1, { body: { attendant: 'Ravi', day: '2026-11-12', from: '09:00', to: '17:00' } })).c).toBe(201);
    expect((await H.call('POST /shifts', T1, { body: { attendant: 'Nobody', day: '2026-11-12', from: '09:00', to: '17:00' } })).c).toBe(400);
    expect((await H.call('POST /shifts', T2, { body: { attendant: 'Ravi', day: '2026-11-12', from: '09:00', to: '17:00' } })).c).toBe(400);
    expect((await H.call('GET /shifts', T1, { query: { month: '2026-11' } })).b.data.rows[0].attendant).toBe('Ravi'); expect((await H.call('GET /shifts', T2, { query: { month: '2026-11' } })).b.data.rows.length).toBe(0);
  });
});
describe('refunds, dues and sales report', () => {
  test('refund by plate: owner only, latest delivered job of this business, never more than paid', async () => {
    const H = harness(); const j = await withJob(H); await withJob(H, T2);
    const post = (t, body, role) => H.call('POST /refunds', t, { body, role });
    expect((await post(T1, { plate: 'TN09AB1234', amount: 100, method: 'cash', reason: 'scratch' }, 'subadmin')).c).toBe(403);
    expect((await post(T1, { plate: 'KA01AB9999', amount: 100, method: 'cash', reason: 'scratch' })).c).toBe(404);
    expect((await post(T1, { plate: 'TN09AB1234', amount: 900, method: 'cash', reason: 'scratch' })).c).toBe(400);
    expect((await post(T1, { plate: 'TN09AB1234', amount: 100, method: 'cash', reason: 'x' })).c).toBe(400);
    const ok = await post(T1, { plate: 'tn09 ab 1234', amount: 100, method: 'cash', reason: 'scratch on door' }); expect(ok.c).toBe(201);
    expect(H.M.Refund.rows.length).toBe(1); expect(H.M.Refund.rows[0].tenantId).toBe(T1); expect(H.M.Job.rows.find((r) => String(r._id) === String(j._id)).refunded).toBe(100); expect(H.M.Job.rows.find((r) => r.tenantId === T2).refunded).toBeUndefined();
    expect((await post(T2, { plate: 'TN09AB1234', amount: 100, method: 'cash', reason: 'scratch on door' })).c).toBe(201); expect(H.M.Refund.rows.filter((r) => r.tenantId === T1).length).toBe(1);
  });
  test('dues list is plain rows for this business; collect everything with one tap (payAllWith)', async () => {
    const H = harness(); const j = await withJob(H, T1, { due: 150, payments: [{ method: 'cash', amount: 250 }] }); await withJob(H, T2, { due: 99 });
    const l = await H.call('GET /dues', T1); expect(l.b.data.length).toBe(1); expect(l.b.data[0].due).toBe(150); expect((await H.call('GET /dues', T2)).b.data[0].due).toBe(99);
    const id = String(j._id); expect((await H.call('POST /jobs/:id/collect', T2, { params: { id }, body: { payAllWith: 'cash' } })).c).toBe(404);
    expect((await H.call('POST /jobs/:id/collect', T1, { params: { id }, body: { payAllWith: 'cheque' } })).c).toBe(400);
    const ok = await H.call('POST /jobs/:id/collect', T1, { params: { id }, body: { payAllWith: 'upi' } }); expect(ok.c).toBe(200); expect(ok.b.data.due).toBe(0); expect(H.M.Collection.rows[0].amount).toBe(150); expect(H.M.Collection.rows[0].method).toBe('upi');
    expect((await H.call('POST /jobs/:id/collect', T1, { params: { id }, body: { payAllWith: 'upi' } })).c).toBe(400); // nothing due any more
  });
  test('sales report: refunds are taken off, by day on the refund day and by class on the original job; unplaced refunds are shown', () => {
    const jobs = [{ _id: 'j1', state: 'delivered', day: '2026-11-10', klass: 'sedan', total: 400, deliveredAt: '2026-11-10T05:00:00Z' }, { _id: 'j2', state: 'delivered', day: '2026-11-11', klass: 'suv', total: 600, deliveredAt: '2026-11-11T05:00:00Z' }];
    const refunds = [{ jobId: 'j1', day: '2026-11-12', amount: 100 }, { jobId: 'gone', day: '2026-11-12', amount: 50 }];
    const d = R.salesBy(jobs, 'day', refunds); expect(d.total).toBe(1000); expect(d.refundedTotal).toBe(150); expect(d.netTotal).toBe(850); expect(d.rows.map((r) => r.key + ':' + r.net).join()).toBe('2026-11-10:400,2026-11-11:600,2026-11-12:-150');
    const c = R.salesBy(jobs, 'class', refunds, { j1: jobs[0] }); expect(c.netTotal).toBe(900); expect(c.unplacedRefunds).toBe(50); expect(c.rows.find((r) => r.key === 'sedan').net).toBe(300);
    expect(R.salesBy(jobs, 'moon', []).error).toBeTruthy();
  });
  test('sales report route: another business refunds never leak in', async () => {
    const H = harness(); const j = await withJob(H); await H.M.Refund.create({ tenantId: T1, jobId: String(j._id), plate: 'TN09AB1234', day: '2026-11-12', amount: 100, method: 'cash', reason: 'x' });
    const o = await withJob(H, T2); await H.M.Refund.create({ tenantId: T2, jobId: String(o._id), plate: 'TN09AB1234', day: '2026-11-12', amount: 400, method: 'cash', reason: 'y' });
    const q = { from: '2026-11-01', to: '2026-11-30' };
    const a = await H.call('GET /reports/sales', T1, { query: { ...q, by: 'class' } }); expect(a.b.data.total).toBe(400); expect(a.b.data.refundedTotal).toBe(100); expect(a.b.data.netTotal).toBe(300);
    const b = await H.call('GET /reports/sales', T2, { query: { ...q, by: 'day' } }); expect(b.b.data.netTotal).toBe(0);
  });
});
describe('register import in one box', () => {
  const csv = 'Vehicle number,Class,Owner,Phone\nTN09AB1234,sedan,Anu,9876543210\nTN09AB1235,suv,Bala,9876543211\nBAD,sedan,X,1\n';
  test('check changes nothing; save needs the skip tick when rows have problems; owner only; stays in this business', async () => {
    const H = harness(); await H.M.Vehicle.create({ tenantId: T1, plate: 'TN09AB1234', klass: 'sedan' });
    expect((await H.call('POST /vehicles/import', T1, { body: { csv, mode: 'check' }, role: 'subadmin' })).c).toBe(403);
    expect((await H.call('POST /vehicles/import', T1, { body: { csv } })).c).toBe(400);
    const c = await H.call('POST /vehicles/import', T1, { body: { csv, mode: 'check' } }); expect(c.c).toBe(200); expect(c.b.message).toMatch(/2 fine \(1 new, 1 will update\), 1 with problems/); expect(H.M.Vehicle.rows.length).toBe(1);
    expect((await H.call('POST /vehicles/import', T1, { body: { csv, mode: 'save' } })).c).toBe(400);
    const s = await H.call('POST /vehicles/import', T1, { body: { csv, mode: 'save', skipErrors: true } }); expect(s.c).toBe(201); expect(s.b.data).toEqual({ added: 1, updated: 1, skipped: 1 });
    expect(H.M.Vehicle.rows.filter((r) => r.tenantId === T1).length).toBe(2); expect(H.M.Vehicle.rows.filter((r) => r.tenantId === T2).length).toBe(0);
    expect((await H.call('GET /vehicles/import', T1)).b.data.length).toBe(1); expect((await H.call('GET /vehicles/import', T2)).b.data.length).toBe(0); expect((await H.call('GET /vehicles/import', T1, { role: 'subadmin' })).c).toBe(403);
  });
});
describe('photo upload to local disk', () => {
  const up = (H, t, id, body, ct = 'image/jpeg', kind = 'before', role) => H.call('POST /jobs/:id/photos/upload', t, { params: { id }, query: { kind }, body, headers: { 'content-type': ct }, role });
  test('storage: key shape, type sniffing, a real folder round trip, no escaping the folder', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'washph-')); const d = ST.localDisk(dir); const key = ST.newKey(T1, T1, 'image/jpeg'); expect(ST.KEY.test(key)).toBe(true);
    await d.put(key, JPG); expect((await d.get(key)).equals(JPG)).toBe(true); await d.remove(key); expect(await d.get(key)).toBeNull();
    let threw = false; try { await d.get('../../etc/passwd'); } catch (e) { threw = true; } expect(threw).toBe(true);
    expect(ST.sniff(JPG)).toBe('image/jpeg'); expect(ST.sniff(Buffer.from('<?php echo 1; ?>......'))).toBeNull(); expect(ST.sniff(Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WEBP')]))).toBe('image/webp');
    expect(ST.fromEnv({})).toBeNull(); expect(ST.fromEnv({ WASH_PHOTO_DIR: 'relative/dir' })).toBeNull(); expect(ST.fromEnv({ WASH_PHOTO_DIR: dir }).kind).toBe('local');
  });
  test('no storage set up gives 503, not a guess', async () => {
    const H = harness({ store: null }); const j = await withJob(H); expect((await up(H, T1, String(j._id), JPG)).c).toBe(503);
  });
  test('upload: own job only, type must match the file, size limit, six per kind, bytes read back only by this business', async () => {
    const H = harness(); const j = await withJob(H); const id = String(j._id);
    expect((await up(H, T2, id, JPG)).c).toBe(404);
    expect((await up(H, T1, id, JPG, 'image/jpeg', 'during')).c).toBe(400);
    expect((await up(H, T1, id, Buffer.from('<?php echo 1; ?>...........'), 'image/jpeg')).c).toBe(400);
    expect((await up(H, T1, id, JPG, 'image/png')).c).toBe(400);
    expect((await up(H, T1, id, Buffer.concat([JPG, Buffer.alloc(300 * 1024)]))).c).toBe(413);
    expect((await up(H, T1, id, 'not a buffer')).c).toBe(400);
    const ok = await up(H, T1, id, JPG); expect(ok.c).toBe(201); const pid = ok.b.data.id; const rec = H.M.Photo.rows[0];
    expect(rec.ref.startsWith(T1 + '/')).toBe(true); expect(rec.store).toBe('local'); expect(rec.bytes).toBe(JPG.length); expect(H.M.UsageLog.rows.length).toBe(1);
    const f = await H.call('GET /photos/:id/file', T1, { params: { id: pid } }); expect(f.c).toBe(200); expect(f.h['Content-Type']).toBe('image/jpeg'); expect(f.h['X-Content-Type-Options']).toBe('nosniff'); expect(Buffer.isBuffer(f.text)).toBe(true);
    expect((await H.call('GET /photos/:id/file', T2, { params: { id: pid } })).c).toBe(404);
    for (let i = 0; i < 5; i++) expect((await up(H, T1, id, JPG)).c).toBe(201); expect((await up(H, T1, id, JPG)).c).toBe(409); expect((await up(H, T1, id, JPG, 'image/jpeg', 'after')).c).toBe(201);
  });
  test('a reference typed into the older route can never read a file; list is per business; only the owner removes', async () => {
    const H = harness(); const mine = await withJob(H); const theirs = await withJob(H, T2); const store = H.store;
    const secret = (await up(H, T2, String(theirs._id), JPG)).b.data.id; const theirRef = H.M.Photo.rows[0].ref;
    const evil = await H.call('POST /jobs/:id/photos', T1, { params: { id: String(mine._id) }, body: { kind: 'before', ref: theirRef, bytes: 10, mime: 'image/jpeg' } });
    expect(evil.c).toBe(201); expect((await H.call('GET /photos/:id/file', T1, { params: { id: evil.b.data.id } })).c).toBe(404);
    const mineId = (await up(H, T1, String(mine._id), JPG)).b.data.id;
    const l = await H.call('GET /photos', T1); expect(l.b.data.every((x) => x.id !== secret)).toBe(true); expect(l.b.data.some((x) => x.id === mineId && x.plate === 'TN09AB1234')).toBe(true);
    expect((await H.call('POST /photos/:id/remove', T1, { params: { id: mineId }, role: 'subadmin' })).c).toBe(403); expect((await H.call('POST /photos/:id/remove', T2, { params: { id: mineId } })).c).toBe(404);
    const ref = H.M.Photo.rows.find((r) => String(r._id) === mineId).ref; expect(!!store.files[ref]).toBe(true);
    expect((await H.call('POST /photos/:id/remove', T1, { params: { id: mineId } })).c).toBe(200); expect(!!store.files[ref]).toBe(false); expect(H.M.Photo.rows.some((r) => String(r._id) === mineId)).toBe(false); expect(!!store.files[theirRef]).toBe(true);
  });
});
describe('job card page', () => {
  test('own job only, every value escaped, no scripts, no-store; shows bay and totals', async () => {
    const H = harness(); await seed(H); const j = await withJob(H, T1, { bay: 'Bay 2', klass: '<img src=x onerror=1>', discount: 50, total: 350 }); await seed(H, T2);
    const ok = await H.call('GET /jobs/:id/card', T1, { params: { id: String(j._id) } }); expect(ok.c).toBe(200); expect(ok.h['Content-Type']).toMatch(/text\/html/); expect(ok.h['Cache-Control']).toBe('no-store'); expect(ok.h['Content-Security-Policy']).toMatch(/default-src 'none'/);
    expect(ok.text.includes('<img src=x')).toBe(false); expect(ok.text.includes('&lt;img')).toBe(true); expect(ok.text.includes('Sparkle &lt;b&gt;Wash')).toBe(true); expect(/<script/i.test(ok.text)).toBe(false); expect(ok.text).toMatch(/Bay 2/); expect(ok.text).toMatch(/Rs 350/);
    expect((await H.call('GET /jobs/:id/card', T2, { params: { id: String(j._id) } })).c).toBe(404); expect((await H.call('GET /jobs/:id/card', T1, { params: { id: 'nope' } })).c).toBe(404);
    expect(jobCardHtml({ job: { number: 1, plate: 'A', lines: [] }, businessName: '' })).toMatch(/Job card/);
  });
});
