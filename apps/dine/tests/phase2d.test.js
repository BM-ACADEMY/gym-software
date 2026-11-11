const IM = require('../src/importers'); const { build, TID } = require('./p2fake');
const ING = 'Name,Unit,Cost,Stock\nRice,kg,60,20\nOil,l,150,5\nRice,kg,60,1\n=cmd(),kg,1,1\nSalt,kg,abc,2\n';
describe('CSV import (Dine Phase 2)', () => {
  test('ingredients: good rows kept, duplicates, formulas and bad numbers reported with row numbers', () => {
    const r = IM.parseIngredients(ING);
    expect(r.ok.map((x) => x.name)).toEqual(['Rice', 'Oil']); expect(r.errors.map((e) => e.row)).toEqual([4, 5, 6]);
    expect(r.errors[1].message).toMatch(/= \+ - or @/); expect(r.ok[0].costPerUnit).toBe(60);
    expect(() => IM.parseIngredients('Foo,Bar\n1,2')).toThrow(); expect(() => IM.parseIngredients('')).toThrow();
  });
  test('recipes: dish by key or name, ingredient must exist, quantity above zero, one line per ingredient', () => {
    const dishes = [{ key: 'dosa', name: 'Masala Dosa' }]; const ings = [{ id: 'i1', name: 'Rice' }, { id: 'i2', name: 'Oil' }];
    const r = IM.parseRecipes('Dish,Ingredient,Qty,Portion\nmasala dosa,rice,0.1,1\nDosa,Oil,0.01,1\nDosa,Oil,0.02,1\nIdli,Rice,1,1\nDosa,Ghee,1,1\nDosa,Rice,0,1\n', dishes, ings);
    expect(r.ok.length).toBe(1); expect(r.ok[0].dishKey).toBe('dosa'); expect(r.ok[0].parts.map((p) => p.ingredientId)).toEqual(['i1', 'i2']);
    expect(r.errors.map((e) => e.row)).toEqual([4, 5, 6, 7]);
  });
  test('guests: shared parser; opening credit is reported, not kept', () => {
    const r = IM.parseGuests('Name,Mobile,Credit,Points\nRavi,9876543210,500,20\nSita,,0,0\nBad,123,0,0\n');
    expect(r.ok.length).toBe(2); expect(r.ignoredCredit).toBe(1); expect(r.ok[0].points).toBe(20); expect(r.errors.length).toBe(1);
  });
  test('preview saves nothing; commit re-reads the file, skips what exists, and is audited', async () => {
    const t = build({ over: { 'Ingredient.find': [{ _id: 'x'.repeat(24), name: 'Rice' }] } });
    const p = await t.run('post', '/import/ingredients/preview', { body: { csv: ING } }); expect(p.status).toBe(200); expect(p.b.data.good).toBe(2); expect(p.b.data.alreadyThere).toBe(1);
    expect(t.calls.some((c) => c.meth === 'create')).toBe(false);
    const c = await t.run('post', '/import/ingredients/commit', { body: { csv: ING } }); expect(c.b.data.added).toBe(1); expect(c.b.data.skippedExisting).toBe(1);
    const made = t.calls.filter((x) => x.model === 'Ingredient' && x.meth === 'create'); expect(made.length).toBe(1); expect(String(made[0].args[0].tenantId)).toBe(TID);
    expect(t.calls.some((x) => x.model === 'Activity' && x.args[0].action === 'import.ingredients')).toBe(true);
  });
  test('guests commit: new people added, existing phone left alone, opening points go to the ledger; needs the customers permission', async () => {
    const t = build({ over: { 'Customer.findOne': (q) => (q.phone === '9000000001' ? { _id: 'z' } : null) } });
    const csv = 'Name,Mobile,Points\nRavi,9876543210,20\nOld,9000000001,5\n';
    const c = await t.run('post', '/import/guests/commit', { body: { csv } }); expect(c.b.data.added).toBe(1); expect(c.b.data.alreadyThere).toBe(1); expect(c.b.data.openingPoints).toBe(20);
    expect(t.calls.some((x) => x.model === 'Loyalty' && x.args[0].points === 20 && x.args[0].reason === 'opening')).toBe(true);
    const kitchen = { id: 'u', tenantId: TID, role: 'subadmin', staffRole: 'kitchen' };
    expect((await t.run('post', '/import/guests/commit', { body: { csv }, user: kitchen })).status).toBe(403);
    expect((await t.run('post', '/import/recipes/preview', { body: {} })).status).toBe(400);
    expect((await t.run('post', '/import/recipes/preview', { body: { csv: 'x'.repeat(150001) } })).status).toBe(400);
  });
});
