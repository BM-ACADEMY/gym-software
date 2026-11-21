const { call } = require('./fake'); const { setupMore, ownerOf, staffOf, B } = require('./helpers'); const ST = require('./../src/stock');
describe('Phase 2 (6): retail stock and product use', () => {
  test('pure: product checks, use list checks, run-out is an estimate and says when data is thin, count difference', () => {
    expect(ST.validateProduct({ name: '', price: 100 }).error).toBeTruthy(); expect(ST.validateProduct({ name: 'Shampoo', price: 250, stock: 10 }).value.name).toBe('Shampoo');
    expect(ST.validateUses([{ productId: 'x', qty: 0 }]).error).toBeTruthy();
    const thin = ST.runOut({ stock: 10, moves: [], today: '2026-11-12' }); expect(JSON.stringify(thin)).toMatch(/not enough/i);
    expect(ST.countDiff({ system: 10, counted: 8 }).diff).toBe(-2); expect(ST.countDiff({ system: 10, counted: 10 }).diff).toBe(0);
  });
  test('route: owner adds product, buys stock, bill with product line uses server price and lowers stock; void restores; staff cannot add; other business cannot see', async () => {
    const s = await setupMore(); const M = s.M; const t = B.istParts().date;
    const add = (who, body) => call(s.more, 'POST', '/products', { ...who, body });
    expect((await add(staffOf(s.A.id, s.A.staffId), { name: 'Shampoo', price: 250, stock: 5 })).code).toBe(403); expect((await add(ownerOf(s.A.id), { name: '', price: 1 })).code).toBe(400);
    const p = await add(ownerOf(s.A.id), { name: 'Shampoo', price: 250, stock: 5, reorderLevel: 2 }); expect(p.code).toBe(201); const pid = p.body.data.id || String(p.body.data._id);
    expect((await call(s.more, 'POST', '/products/:id/purchase', { ...ownerOf(s.A.id), params: { id: pid }, body: { qty: 5 } })).code).toBe(200);
    expect((await call(s.more, 'GET', '/products', ownerOf(s.Bt.id))).body.data.length).toBe(0);
    const mk = await call(s.router, 'POST', '/bills', { ...ownerOf(s.A.id), body: { lines: [{ productId: pid, qty: 2, unitPrice: 1 }], payments: [{ method: 'cash', amount: 500 }] } });
    expect(mk.code).toBe(201); expect(mk.body.data.total).toBe(500); expect((await M.Product.findOne({ _id: pid })).stock).toBe(8);
    expect((await call(s.more, 'POST', '/bills/:id/void', { ...ownerOf(s.A.id), params: { id: mk.body.data.id }, body: { reason: 'wrong bill' } })).code).toBe(200); expect((await M.Product.findOne({ _id: pid })).stock).toBe(10);
  });
  test('route: stock count keeps the difference and shows it in alerts; low stock shows in alerts', async () => {
    const s = await setupMore(); const M = s.M;
    const p = await call(s.more, 'POST', '/products', { ...ownerOf(s.A.id), body: { name: 'Serum', price: 400, stock: 10, reorderLevel: 3 } }); const pid = p.body.data.id || String(p.body.data._id);
    const c = await call(s.more, 'POST', '/products/:id/count', { ...ownerOf(s.A.id), params: { id: pid }, body: { counted: 2 } }); expect(c.code).toBe(200); expect(c.body.data.diff).toBe(-8); expect((await M.Product.findOne({ _id: pid })).stock).toBe(2);
    const al = await call(s.router, 'GET', '/alerts', ownerOf(s.A.id)); const kinds = al.body.data.items.map((x) => x.kind); expect(kinds).toContain('stock_mismatch'); expect(kinds).toContain('stock_low');
    expect((await call(s.more, 'GET', '/stock/runout', ownerOf(s.A.id))).code).toBe(200);
  });
});
