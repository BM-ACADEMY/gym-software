const R = require('../src/returnsRules');
describe('returns and exchanges restore variant stock (CLO-12)', () => {
  const sales = [{ variantId: 'v1', qty: 2 }, { variantId: 'f1', qty: 250 }];
  test('whole pieces, never more than sold, earlier returns count', () => {
    expect(R.plan({ sales, done: [], items: [{ variantId: 'v1', qty: 1 }], reason: 'wrong size' }).moves).toEqual([{ variantId: 'v1', qty: 1 }]);
    expect(R.plan({ sales, done: [{ variantId: 'v1', qty: 1 }], items: [{ variantId: 'v1', qty: 2 }], reason: 'wrong size' }).error).toMatch(/more than was sold/);
    expect(R.plan({ sales, done: [], items: [{ variantId: 'v1', qty: 1.5 }], reason: 'wrong size' }).error).toMatch(/whole number/);
    expect(R.plan({ sales, done: [], items: [{ variantId: 'zz', qty: 1 }], reason: 'wrong size' }).error).toMatch(/not sold/);
  });
  test('fabric in metres becomes centimetres; same item twice adds up', () => {
    const p = R.plan({ sales, done: [], items: [{ variantId: 'f1', qty: 1 }, { variantId: 'f1', qty: 0.5 }], units: { f1: 'metre' }, reason: 'colour fault', kind: 'exchange' });
    expect(p.moves).toEqual([{ variantId: 'f1', qty: 150 }]); expect(p.kind).toBe('exchange');
    expect(R.plan({ sales, done: [], items: [{ variantId: 'f1', qty: 3 }], units: { f1: 'metre' }, reason: 'colour fault' }).error).toMatch(/more than was sold/);
    expect(R.plan({ sales, done: [], items: [{ variantId: 'f1', qty: 1.234 }], units: { f1: 'metre' }, reason: 'colour fault' }).error).toMatch(/2 decimals/);
  });
  test('reason and kind are required', () => {
    expect(R.plan({ sales, items: [{ variantId: 'v1', qty: 1 }], reason: 'x' }).error).toMatch(/reason/); expect(R.plan({ sales, items: [{ variantId: 'v1', qty: 1 }], reason: 'abc', kind: 'gift' }).error).toMatch(/Kind/); expect(R.plan({ sales, items: [], reason: 'abc' }).error).toMatch(/at least one/);
  });
});
