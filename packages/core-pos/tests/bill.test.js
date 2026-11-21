const { bill, loyalty, stock } = require('../src');

const throwsCode = (fn, code) => { try { fn(); } catch (e) { return e.code === code; } return false; };

describe('bill.compute', () => {
  test('plain bill: no GST', () => {
    const b = bill.compute({ lines: [{ name: 'Haircut', unitPrice: 200, qty: 1 }, { name: 'Shave', unitPrice: 100, qty: 2 }] });
    expect(b.total).toBe(400); expect(b.gst).toBe(0); expect(b.currency).toBe('INR');
  });
  test('GST exclusive 18%: added on top, split in two halves', () => {
    const b = bill.compute({ lines: [{ name: 'Facial', unitPrice: 1000, qty: 1, gstRate: 18 }], taxMode: 'gst_exclusive' });
    expect(b.taxable).toBe(1000); expect(b.gst).toBe(180); expect(b.total).toBe(1180); expect(b.cgst).toBe(90); expect(b.sgst).toBe(90); expect(b.igst).toBe(0);
  });
  test('IGST for another state', () => {
    const b = bill.compute({ lines: [{ name: 'Facial', unitPrice: 1000, qty: 1, gstRate: 18 }], taxMode: 'gst_exclusive', gstMode: 'igst' });
    expect(b.igst).toBe(180); expect(b.cgst).toBe(0); expect(b.total).toBe(1180);
  });
  test('GST inclusive: shelf price contains the tax', () => {
    const b = bill.compute({ lines: [{ name: 'Soap', unitPrice: 118, qty: 1, gstRate: 18 }], taxMode: 'gst_inclusive' });
    expect(b.total).toBe(118); expect(b.taxable).toBe(100); expect(b.gst).toBe(18);
  });
  test('line percent discount and bill amount discount are shared so the parts add up exactly', () => {
    const b = bill.compute({
      lines: [{ name: 'A', unitPrice: 333, qty: 1 }, { name: 'B', unitPrice: 333, qty: 1 }, { name: 'C', unitPrice: 334, qty: 1 }],
      billDiscount: { type: 'amount', value: 100 },
    });
    expect(b.total).toBe(900);
    expect(b.lines.reduce((a, l) => a + l.billDiscountShare, 0)).toBe(100);
    expect(b.discount).toBe(100);
  });
  test('discount can never push a line below zero', () => {
    const b = bill.compute({ lines: [{ name: 'A', unitPrice: 100, qty: 1, discount: { type: 'amount', value: 500 } }] });
    expect(b.total).toBe(0);
  });
  test('refuses bad input', () => {
    expect(throwsCode(() => bill.compute({ lines: [] }), 'BILL_INVALID')).toBe(true);
    expect(throwsCode(() => bill.compute({ lines: [{ name: 'x', unitPrice: 10, qty: 0 }] }), 'BILL_INVALID')).toBe(true);
    expect(throwsCode(() => bill.compute({ lines: [{ name: 'x', unitPrice: 10, qty: 1, gstRate: 7 }], taxMode: 'gst_exclusive' }), 'BILL_INVALID')).toBe(true);
    expect(throwsCode(() => bill.compute({ lines: [{ name: 'x', unitPrice: 10, qty: 1, discount: { type: 'percent', value: 150 } }] }), 'BILL_INVALID')).toBe(true);
  });
  test('allocate keeps the exact total', () => {
    expect(bill.allocate(10, [1, 1, 1]).reduce((a, b) => a + b, 0)).toBe(10);
    expect(bill.allocate(0, [5, 5])).toEqual([0, 0]);
  });
});

describe('bill.settle', () => {
  test('cash overpay gives change', () => {
    const s = bill.settle(450, [{ method: 'cash', amount: 500 }]);
    expect(s.change).toBe(50); expect(s.received).toBe(450); expect(s.status).toBe('paid'); expect(s.due).toBe(0);
  });
  test('split payment cash + UPI', () => {
    const s = bill.settle(1000, [{ method: 'cash', amount: 400 }, { method: 'upi', amount: 600 }]);
    expect(s.status).toBe('paid'); expect(s.change).toBe(0);
  });
  test('partial and unpaid', () => {
    expect(bill.settle(1000, [{ method: 'upi', amount: 300 }]).status).toBe('partial');
    expect(bill.settle(1000, []).status).toBe('unpaid');
    expect(bill.settle(1000, [{ method: 'upi', amount: 300 }]).due).toBe(700);
  });
  test('pay later (credit) is its own status', () => {
    const s = bill.settle(1000, [{ method: 'cash', amount: 200 }, { method: 'credit', amount: 800 }]);
    expect(s.status).toBe('credit'); expect(s.due).toBe(0); expect(s.credit).toBe(800);
  });
  test('card or UPI above the bill is refused; unknown method refused', () => {
    expect(throwsCode(() => bill.settle(500, [{ method: 'upi', amount: 600 }]), 'BILL_INVALID')).toBe(true);
    expect(throwsCode(() => bill.settle(500, [{ method: 'bitcoin', amount: 500 }]), 'BILL_INVALID')).toBe(true);
  });
});

describe('loyalty', () => {
  test('earn from what was paid', () => { expect(loyalty.earn(1000)).toBe(50); expect(loyalty.earn(0)).toBe(0); expect(loyalty.earn(-5)).toBe(0); });
  test('redeem is capped at half the bill and needs enough points', () => {
    expect(loyalty.redeem({ requestedPoints: 500, balance: 500, billTotal: 400 })).toEqual({ points: 200, rupees: 200 });
    expect(throwsCode(() => loyalty.redeem({ requestedPoints: 100, balance: 50, billTotal: 1000 }), 'LOYALTY_INVALID')).toBe(true);
    expect(throwsCode(() => loyalty.redeem({ requestedPoints: 10, balance: 500, billTotal: 1000 }), 'LOYALTY_INVALID')).toBe(true);
    expect(loyalty.redeem({ requestedPoints: 0, balance: 5, billTotal: 100 })).toEqual({ points: 0, rupees: 0 });
  });
  test('balance is the ledger sum; a return reverses the points', () => {
    expect(loyalty.balanceOf([{ points: 50 }, { points: -20 }, { points: 5 }])).toBe(35);
    expect(loyalty.reverseForReturn({ earned: 50, redeemed: 20 })).toEqual({ points: -30 });
  });
});

describe('stock', () => {
  test('in and out; selling more than you have is refused', () => {
    expect(stock.apply(10, { type: 'sale', qty: 3 })).toBe(7);
    expect(stock.apply(10, { type: 'purchase', qty: 5 })).toBe(15);
    expect(throwsCode(() => stock.apply(2, { type: 'sale', qty: 3 }), 'STOCK_INVALID')).toBe(true);
    expect(stock.apply(2, { type: 'sale', qty: 3 }, { allowNegative: true })).toBe(-1);
    expect(throwsCode(() => stock.apply(2, { type: 'steal', qty: 1 }), 'STOCK_INVALID')).toBe(true);
  });
  test('quantity from movements, low stock list', () => {
    expect(stock.quantityOf([{ type: 'opening', qty: 20 }, { type: 'sale', qty: 5 }, { type: 'waste', qty: 1 }])).toBe(14);
    expect(stock.lowStock([{ id: 1, qty: 2, reorderLevel: 5 }, { id: 2, qty: 9, reorderLevel: 5 }, { id: 3, qty: 1 }]).map((i) => i.id)).toEqual([1]);
  });
  test('expiry list and first-expiry-first-out', () => {
    const now = new Date('2026-11-01T00:00:00Z');
    const batches = [{ id: 'a', qty: 5, expiresAt: '2026-12-15' }, { id: 'b', qty: 5, expiresAt: '2026-11-10' }, { id: 'c', qty: 5, expiresAt: '2026-10-20' }, { id: 'd', qty: 0, expiresAt: '2026-11-02' }];
    const e = stock.expiring(batches, now, 30);
    expect(e.map((x) => x.id)).toEqual(['c', 'b']);
    expect(e[0].expired).toBe(true);
    expect(stock.pickBatches(batches, 7)).toEqual([{ batchId: 'c', qty: 5 }, { batchId: 'b', qty: 2 }]);
    expect(throwsCode(() => stock.pickBatches(batches, 99), 'STOCK_INVALID')).toBe(true);
  });
});
