const { model, mkRouter, call } = require('./fake');
const { createClothRouter } = require('../src/routes');
const bills = [
  { id: 'b1', number: 'CL1', date: '2026-11-10', total: 1050, taxable: 1000, gst: 50, discount: 0, status: 'paid', by: 's1', customerId: 'c1', lines: [{ taxable: 1000, rate: 5 }] },
  { id: 'b2', number: 'CL2', date: '2026-11-11', total: 750, taxable: 750, gst: 0, discount: 250, status: 'paid', by: 's1', customerId: 'c2', lines: [{ taxable: 750, rate: 0 }] },
  { id: 'b3', number: 'CL3', date: '2026-11-11', total: 500, taxable: 500, gst: 0, discount: 0, status: 'returned', by: 's1', lines: [] },
];
const mk = () => {
  const { r, router } = mkRouter();
  const M = { Settings: model(), Variant: model(), StockMove: model(), Alteration: model(), CustomerInfo: model(), PosCustomer: model(), Expense: model(), DayClose: model(), SupplierBill: model(), Staff: model(), Attendance: model(), BillDiscount: model() };
  createClothRouter({ express: { Router: () => router }, M, protect: 'P', authorize: () => 'A', tenantOf: (req) => req.user.tenantId, now: () => new Date('2026-11-12T06:00:00Z'), billsBetween: async (tid, f, t) => (tid === 'a' ? bills.filter((b) => b.date >= f && b.date <= t) : []) });
  return { r, M };
};
const A = { user: { id: 'u1', tenantId: 'a' } }; const B = { user: { id: 'u2', tenantId: 'b' } }; const post = (b, x = A) => ({ ...x, method: 'POST', body: b });
describe('accounts routes', () => {
  test('expenses: add, validate, list with category totals, per shop', async () => {
    const { r } = mk();
    expect((await call(r['POST /expenses'], post({ date: '2026-11-10', amount: 8000, category: 'rent' }))).c).toBe(201);
    expect((await call(r['POST /expenses'], post({ date: '2026-11-11', amount: 300, category: 'tea_food' }))).c).toBe(201);
    expect((await call(r['POST /expenses'], post({ date: 'bad', amount: 5 }))).c).toBe(400);
    const l = (await call(r['GET /expenses'], A)).b.data; expect(l.rows.length).toBe(2); expect(l.byCategory.rent).toBe(8000);
    expect((await call(r['GET /expenses'], B)).b.data.rows.length).toBe(0); expect((await call(r['GET /expenses'], { ...A, query: { from: '2026-11-12', to: '2026-11-01' } })).c).toBe(400);
  });
  test('day close: matched/short, saved once per day, listed per shop', async () => {
    const { r } = mk();
    const s = await call(r['POST /day-close'], post({ opening: 1000, cashIn: 5000, cashOut: 500, counted: 5400 })); expect(s.b.data.status).toBe('short'); expect(s.b.text).toMatch(/Rs 100 short/);
    await call(r['POST /day-close'], post({ opening: 1000, cashIn: 5000, cashOut: 500, counted: 5500 })); const l = (await call(r['GET /day-close'], A)).b.data; expect(l.length).toBe(1); expect(l[0].status).toBe('matched');
    expect((await call(r['POST /day-close'], post({ opening: 1.5, cashIn: 0, cashOut: 0, counted: 0 }))).c).toBe(400); expect((await call(r['GET /day-close'], B)).b.data.length).toBe(0);
  });
  test('supplier bills: add, pay part, cannot overpay, dues ageing, other shop cannot pay', async () => {
    const { r, M } = mk();
    expect((await call(r['POST /supplier-bills'], post({ supplier: 'Sri Mills', amount: 10000, dueOn: '2026-11-02' }))).c).toBe(201);
    expect((await call(r['POST /supplier-bills'], post({ supplier: 'x', amount: 10, dueOn: '2026-11-02' }))).c).toBe(400);
    const id = M.SupplierBill.rows[0]._id;
    expect((await call(r['POST /supplier-bills/:id/pay'], { ...post({ amount: 4000 }), params: { id } })).b.data.paid).toBe(4000);
    expect((await call(r['POST /supplier-bills/:id/pay'], { ...post({ amount: 7000 }), params: { id } })).c).toBe(400);
    expect((await call(r['POST /supplier-bills/:id/pay'], { ...post({ amount: 100 }, B), params: { id } })).c).toBe(404);
    const d = (await call(r['GET /supplier-dues'], A)).b.data; expect(d.total).toBe(6000); expect(d.late1to30).toBe(6000); expect((await call(r['GET /supplier-dues'], B)).b.data.total).toBe(0);
  });
  test('profit and loss, GST summary, CA export use only this shop and skip returned bills', async () => {
    const { r, M } = mk(); await call(r['POST /expenses'], post({ date: '2026-11-10', amount: 200, category: 'rent' }));
    const v = await M.Variant.create({ tenantId: 'a', style: 'S', size: 'M', colour: 'B', key: 'k', mrp: 1, cost: 300, qty: 5 }); await M.StockMove.create({ tenantId: 'a', variantId: v._id, type: 'sale', qty: 2, date: '2026-11-10' });
    const q = { from: '2026-11-01', to: '2026-11-12' };
    const p = (await call(r['GET /reports/profit-loss'], { ...A, query: q })).b.data; expect(p.sales).toBe(1750); expect(p.cogs).toBe(600); expect(p.netProfit).toBe(950); expect((await call(r['GET /reports/profit-loss'], { ...B, query: q })).b.data.sales).toBe(0);
    const g = (await call(r['GET /reports/gst-summary'], { ...A, query: q })).b.data; expect(g.tax).toBe(50); expect(g.rows.length).toBe(2);
    const c = await call(r['GET /export/ca.csv'], { ...A, query: q }); expect(c.h['Content-Type']).toMatch(/text\/csv/); expect(c.text.split('\n').length).toBe(4); expect(c.text).toMatch(/CL1/); expect(c.text).not.toMatch(/CL3/);
    expect((await call(r['GET /reports/profit-loss'], { ...A, query: { from: 'x' } })).c).toBe(400);
  });
  test('sales report by day, week and month', async () => {
    const { r } = mk(); const q = { from: '2026-11-01', to: '2026-11-12' };
    expect((await call(r['GET /reports/sales'], { ...A, query: { ...q, by: 'day' } })).b.data.rows.map((x) => x.total)).toEqual([1050, 750]);
    const w = (await call(r['GET /reports/sales'], { ...A, query: { ...q, by: 'week' } })).b.data.rows; expect(w.length).toBe(1); expect(w[0].period).toBe('2026-11-09'); expect(w[0].total).toBe(1800);
    expect((await call(r['GET /reports/sales'], { ...A, query: { ...q, by: 'month' } })).b.data.rows[0].period).toBe('2026-11');
  });
});
describe('staff, predictions, leaks, marketing', () => {
  test('staff: add, attendance, pay for the month, per shop', async () => {
    const { r, M } = mk(); expect((await call(r['POST /staff'], post({ name: 'Anu', salary: 15000 }))).c).toBe(201); expect((await call(r['POST /staff'], post({ name: 'A' }))).c).toBe(400);
    const id = M.Staff.rows[0]._id;
    expect((await call(r['POST /staff/:id/attendance'], { ...post({ date: '2026-11-03', status: 'absent' }), params: { id } })).c).toBe(200);
    expect((await call(r['POST /staff/:id/attendance'], { ...post({ date: '2026-11-04', status: 'nope' }), params: { id } })).c).toBe(400);
    expect((await call(r['POST /staff/:id/attendance'], { ...post({ status: 'present' }, B), params: { id } })).c).toBe(404);
    const p = (await call(r['GET /staff/:id/pay'], { ...A, params: { id }, query: { month: '2026-11' } })).b.data; expect(p.pay).toBe(14500);
    expect((await call(r['GET /staff/:id/pay'], { ...A, params: { id }, query: { month: 'bad' } })).c).toBe(400); expect((await call(r['GET /staff'], B)).b.data.length).toBe(0);
  });
  test('predictions: labelled estimates; empty shop gets nulls not errors', async () => {
    const { r } = mk(); const d = (await call(r['GET /predictions'], A)).b.data; expect(d.note).toMatch(/estimates/); expect(d.nextMonth).toBe(null); expect(d.cashNeeded.estimate).toBe(true);
    expect((await call(r['GET /predictions'], B)).c).toBe(200);
  });
  test('leaks: heavy discount found for this shop only', async () => {
    const { r } = mk(); const d = (await call(r['GET /reports/leaks'], A)).b.data; expect(d.heavyDiscounts.length).toBe(1); expect(d.heavyDiscounts[0].number).toBe('CL2'); expect((await call(r['GET /reports/leaks'], B)).b.data.heavyDiscounts.length).toBe(0);
  });
  test('marketing ideas are suggestions with reasons and templates still needing approval', async () => {
    const { r, M } = mk(); await M.CustomerInfo.create({ tenantId: 'a', customerId: 'c'.repeat(24), lastVisit: '2026-06-01' });
    const m = (await call(r['GET /marketing-ideas'], A)).b.data; expect(m.mode).toBe('suggest'); expect(m.ideas.map((i) => i.key)).toContain('winback'); expect(m.ideas.every((i) => i.reason && i.template.includes('approval'))).toBe(true);
    expect((await call(r['GET /marketing-ideas'], B)).b.data.ideas.map((i) => i.key)).toEqual(['review']);
  });
});
