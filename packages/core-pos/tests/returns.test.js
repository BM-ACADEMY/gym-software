const { returns } = require('../src');

const throwsCode = (fn, code) => { try { fn(); } catch (e) { return e.code === code; } return false; };
const bill = {
  total: 1000, credit: 0, pointsEarned: 50, pointsUsed: 0, payments: [{ method: 'upi', amount: 1000 }],
  lines: [{ name: 'A', itemId: 'ia', qty: 3, total: 100 }, { name: 'B', itemId: 'ib', qty: 1, total: 900 }],
};

describe('part returns', () => {
  test('one unit back: proportional refund, stock back, points reversed', () => {
    const p = returns.plan({ bill, items: [{ lineIndex: 1, qty: 1 }] });
    expect(p.refund).toBe(900); expect(p.cashBack).toBe(900); expect(p.stockBack).toEqual([{ itemId: 'ib', qty: 1 }]);
    expect(p.points).toBe(-45); expect(p.fullyReturned).toBe(false); expect(p.nextReturnedQty).toEqual([0, 1]);
  });
  test('returning a line in steps adds up to exactly its total (no lost rupee)', () => {
    let rq = []; let sum = 0;
    for (let k = 0; k < 3; k += 1) {
      const p = returns.plan({ bill, items: [{ lineIndex: 0, qty: 1 }], returnedQty: rq });
      sum += p.refund; rq = p.nextReturnedQty;
    }
    expect(sum).toBe(100);
  });
  test('cannot return more than was sold, nor twice the same', () => {
    expect(throwsCode(() => returns.plan({ bill, items: [{ lineIndex: 0, qty: 4 }] }), 'BILL_INVALID')).toBe(true);
    expect(throwsCode(() => returns.plan({ bill, items: [{ lineIndex: 1, qty: 1 }], returnedQty: [0, 1] }), 'BILL_INVALID')).toBe(true);
  });
  test('refuses bad input', () => {
    expect(throwsCode(() => returns.plan({ bill, items: [] }), 'BILL_INVALID')).toBe(true);
    expect(throwsCode(() => returns.plan({ bill, items: [{ lineIndex: 9, qty: 1 }] }), 'BILL_INVALID')).toBe(true);
    expect(throwsCode(() => returns.plan({ bill, items: [{ lineIndex: 0, qty: 0 }] }), 'BILL_INVALID')).toBe(true);
    expect(throwsCode(() => returns.plan({ bill, items: [{ lineIndex: 0, qty: -1 }] }), 'BILL_INVALID')).toBe(true);
  });
  test('refund cancels pay-later first, then goes back as money', () => {
    const b = { ...bill, credit: 500, payments: [{ method: 'cash', amount: 500 }, { method: 'credit', amount: 500 }], pointsEarned: 0 };
    const p = returns.plan({ bill: b, items: [{ lineIndex: 1, qty: 1 }] });
    expect(p.refund).toBe(900); expect(p.creditReduction).toBe(500); expect(p.cashBack).toBe(400);
  });
  test('points paid by the customer come back as points, not money', () => {
    const b = { ...bill, total: 1000, pointsUsed: 100, pointsEarned: 0, payments: [{ method: 'loyalty', amount: 100 }, { method: 'cash', amount: 900 }] };
    const p = returns.plan({ bill: b, items: [{ lineIndex: 0, qty: 3 }, { lineIndex: 1, qty: 1 }] });
    expect(p.refund).toBe(1000); expect(p.loyaltyBack).toBe(100); expect(p.cashBack).toBe(900); expect(p.points).toBe(100); expect(p.fullyReturned).toBe(true);
  });
  test('fractional quantities (kg) work', () => {
    const b = { total: 250, lines: [{ name: 'Rice', itemId: 'r', qty: 2.5, total: 250 }] };
    const p = returns.plan({ bill: b, items: [{ lineIndex: 0, qty: 1 }] });
    expect(p.refund).toBe(100);
    expect(returns.plan({ bill: b, items: [{ lineIndex: 0, qty: 1.5 }], returnedQty: p.nextReturnedQty }).fullyReturned).toBe(true);
  });
});
