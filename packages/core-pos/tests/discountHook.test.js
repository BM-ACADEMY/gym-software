const { makeDiscountHook, discountPolicy: DP } = require('../src');
const owner = { user: { role: 'admin', id: 'o' } }, staff = { user: { role: 'subadmin', id: 's' } };
const calc = (discount) => ({ discount, subtotal: 500 });
const run = async (hook, req, c, body) => { try { return { r: await hook.beforeBill({ req, tid: 't', body, calc: c }) }; } catch (e) { return { code: e.code, msg: e.message }; } };
describe('shared discount hook (POS-01, D-30)', () => {
  test('no discount: nothing to check, no fields', async () => {
    expect((await run(makeDiscountHook({}), staff, calc(0), {})).r).toEqual({ fields: {} });
  });
  test('discount needs a reason of 3 letters; short reason is a 400-type error', async () => {
    const h = makeDiscountHook({});
    expect((await run(h, staff, calc(10), { discountReason: 'ab' })).code).toBe('BILL_INVALID');
    expect((await run(h, staff, calc(10), {})).code).toBe('BILL_INVALID');
  });
  test('default rule: staff up to 10 percent, over it is a 403-type error, owner never limited', async () => {
    const h = makeDiscountHook({});
    const ok = await run(h, staff, calc(50), { discountReason: 'regular' });
    expect(ok.r.fields).toEqual({ discountBy: 'staff', discountPercent: 10, discountReason: 'regular' });
    expect((await run(h, staff, calc(51), { discountReason: 'regular' })).code).toBe('BILL_FORBIDDEN');
    expect((await run(h, owner, calc(400), { discountReason: 'festival' })).r.fields.discountBy).toBe('owner');
  });
  test("the owner's saved rule is used (owner_only, any) and a bad rule falls back", async () => {
    const mk = (rule) => makeDiscountHook({ getRule: async () => rule });
    expect((await run(mk({ staff: 'owner_only' }), staff, calc(1), { discountReason: 'regular' })).code).toBe('BILL_FORBIDDEN');
    expect((await run(mk({ staff: 'any' }), staff, calc(450), { discountReason: 'regular' })).r.fields.discountPercent).toBe(90);
    expect((await run(mk({ staff: 'x', maxPercent: 999 }), staff, calc(60), { discountReason: 'regular' })).code).toBe('BILL_FORBIDDEN');
  });
  test('afterBill runs the product audit only when a discount was recorded', async () => {
    const seen = []; const h = makeDiscountHook({ onDiscount: async (c) => { seen.push(c.doc.number); } });
    await h.afterBill({ doc: { number: 'A1' } }); await h.afterBill({ doc: { number: 'A2', discountBy: 'staff' } });
    expect(seen).toEqual(['A2']);
  });
  test('shared policy is the same as the default (10 percent)', () => { expect(DP.normalize(undefined)).toEqual({ staff: 'limit', maxPercent: 10 }); });
});
