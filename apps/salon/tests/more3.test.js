const { call } = require('./fake'); const { setupMore, ownerOf, staffOf, B } = require('./helpers'); const CI = require('../src/customerImport'); const PK = require('../src/packages'); const LR = require('../src/loyaltyRule');
const CSV = 'Customer name,Mobile\nRavi Kumar,9840012210\nLakshmi,98440 12345\nNoPhone,\nBad,123\nRavi Again,9840012210\n';
describe('Phase 2 (3): customer import, loyalty, packages', () => {
  test('pure: preview marks new, duplicate and invalid; no phone is reported; owed money is not imported', () => {
    const p = CI.planImport({ text: 'name,phone,credit\nA One,9840012210,500\nB Two,9944551872,0\n,9111111111,0\nC Three,,0', existingPhones: new Set(['9944551872']) });
    expect(p.summary.new).toBe(1); expect(p.summary.duplicates).toBe(1); expect(p.summary.debtNotImported).toBe(1); expect(p.summary.invalid).toBe(2);
  });
  test('route: preview saves nothing; commit adds the new ones; consent only if the owner confirms; other business and staff are refused', async () => {
    const s = await setupMore(); const M = s.M; await M.Customer.create({ tenantId: s.A.id, name: 'Old', phone: '9944551872' });
    const pre = await call(s.more, 'POST', '/customers/import', { ...ownerOf(s.A.id), body: { csv: 'name,phone\nA One,9840012210\nB Two,9944551872\n' } });
    expect(pre.body.preview).toBe(true); expect(pre.body.summary.new).toBe(1); expect((await M.Customer.find({ tenantId: s.A.id })).length).toBe(1);
    const done = await call(s.more, 'POST', '/customers/import', { ...ownerOf(s.A.id), body: { csv: 'name,phone,points\nA One,9840012210,40\nB Two,9944551872,0\n', commit: true } });
    expect(done.code).toBe(201); expect(done.body.added).toBe(1); expect(done.body.skippedDuplicates).toBe(1);
    const c = await M.Customer.findOne({ tenantId: s.A.id, phone: '9840012210' }); expect(c.consent).toBe(undefined); expect(c.loyaltyBalance).toBe(40);
    const done2 = await call(s.more, 'POST', '/customers/import', { ...ownerOf(s.A.id), body: { csv: 'name,phone\nZ Zed,9111111112\n', commit: true, consentConfirmed: true } });
    expect((await M.Customer.findOne({ tenantId: s.A.id, phone: '9111111112' })).consent.source).toBe('import-owner-confirmed'); expect(done2.body.added).toBe(1);
    expect((await M.Customer.find({ tenantId: s.Bt.id })).length).toBe(0);
    expect((await call(s.more, 'POST', '/customers/import', { ...staffOf(s.A.id, s.A.staffId), body: { csv: 'name,phone\nX,9111111119\n', commit: true } })).code).toBe(403);
    expect((await call(s.more, 'POST', '/customers/import', { ...ownerOf(s.A.id), body: { csv: '' } })).code).toBe(400);
  });
  test('loyalty: off by default; a bill earns points when on; redeem cannot be spent twice; rule stays in limits', async () => {
    const s = await setupMore(); const M = s.M; expect(LR.normalize(undefined).enabled).toBe(false); expect(LR.normalize({ enabled: true, earnPer100: 900 }).earnPer100).toBe(5);
    const c = await M.Customer.create({ tenantId: s.A.id, name: 'Ravi', phone: '9840012210' });
    const bill = (tid, st) => call(s.router, 'POST', '/bills', { ...ownerOf(tid), body: { customerId: String(c._id), lines: [{ serviceKey: 'haircut', staffId: st }], payments: [{ method: 'cash', amount: 500 }] } });
    expect((await bill(s.A.id, s.A.staffId)).code).toBe(201); expect((await M.Customer.findOne({ _id: c._id })).loyaltyBalance).toBe(0);
    expect((await call(s.router, 'PUT', '/settings', { ...ownerOf(s.A.id), body: { loyaltyRule: { enabled: true, earnPer100: 10, minRedeem: 10 } } })).code).toBe(200);
    expect((await bill(s.A.id, s.A.staffId)).code).toBe(201); expect((await M.Customer.findOne({ _id: c._id })).loyaltyBalance).toBe(50);
    const r1 = call(s.more, 'POST', '/customers/:id/loyalty/redeem', { ...ownerOf(s.A.id), params: { id: String(c._id) }, body: { points: 40, billTotal: 500 } });
    const r2 = call(s.more, 'POST', '/customers/:id/loyalty/redeem', { ...ownerOf(s.A.id), params: { id: String(c._id) }, body: { points: 40, billTotal: 500 } });
    const codes = [(await r1).code, (await r2).code].sort(); expect(codes[0]).toBe(200); expect(codes[1] === 400 || codes[1] === 409).toBe(true);
    expect((await M.Customer.findOne({ _id: c._id })).loyaltyBalance).toBe(10);
    const info = await call(s.more, 'GET', '/customers/:id/loyalty', { ...ownerOf(s.A.id), params: { id: String(c._id) } }); expect(info.body.data.balance).toBe(10 + 0); 
    expect((await call(s.more, 'GET', '/customers/:id/loyalty', { ...ownerOf(s.Bt.id), params: { id: String(c._id) } })).code).toBe(404);
  });
  test('packages: validate, describe, one winner for the last session, expiry, owner sells, other business cannot use', async () => {
    expect(PK.validate({ name: 'Physio 10', total: 10, price: 5000 }, B.validDate).value.left).toBe(10); expect(PK.validate({ name: 'x', total: 10 }, B.validDate).error).toMatch(/name/); expect(PK.validate({ name: 'Ok name', total: 0 }, B.validDate).error).toMatch(/sessions/);
    expect(PK.describe({ name: 'P', total: 10, left: 6 }, '2026-11-12').text).toBe('4 of 10 used, 6 left.'); expect(PK.describe({ name: 'P', total: 3, left: 0 }, '2026-11-12').status).toBe('finished');
    const s = await setupMore(); const M = s.M; const c = await M.Customer.create({ tenantId: s.A.id, name: 'Ravi', phone: '9840012210' });
    const sell = await call(s.more, 'POST', '/packages', { ...ownerOf(s.A.id), body: { customerId: String(c._id), name: 'Physio 2', total: 2, price: 1000 } }); expect(sell.code).toBe(201);
    const id = sell.body.data.id; const use = (who, pid = id) => call(s.more, 'POST', '/packages/:id/use', { ...who, params: { id: pid } });
    expect((await use(ownerOf(s.Bt.id))).code).toBe(404); expect((await use(ownerOf(s.A.id))).code).toBe(200);
    const [x, y] = await Promise.all([use(ownerOf(s.A.id)), use(staffOf(s.A.id, s.A.staffId))]); expect([x.code, y.code].sort()).toEqual([200, 409]);
    expect((await M.Package.findOne({ _id: id })).left).toBe(0);
    const old = await M.Package.create({ tenantId: s.A.id, customerId: c._id, name: 'Old', total: 5, left: 5, expiresOn: '2020-01-01' }); expect((await use(ownerOf(s.A.id), String(old._id))).code).toBe(409);
    expect((await call(s.more, 'POST', '/packages', { ...staffOf(s.A.id, s.A.staffId), body: { customerId: String(c._id), name: 'Nope', total: 1 } })).code).toBe(403);
    expect((await call(s.more, 'GET', '/packages', { ...ownerOf(s.Bt.id), query: { customerId: String(c._id) } })).body.data.length).toBe(0);
  });
});
