const { bill, receipt } = require('../src');

const throwsCode = (fn, code) => { try { fn(); } catch (e) { return e.code === code; } return false; };
const saved = () => {
  const b = bill.compute({
    lines: [{ name: 'Haircut and beard trim with a very long service name', unitPrice: 1000, qty: 1, gstRate: 18 }, { name: 'Shampoo', unitPrice: 250, qty: 2, gstRate: 18, discount: { type: 'amount', value: 50 } }],
    taxMode: 'gst_exclusive',
  });
  const s = bill.settle(b.total, [{ method: 'cash', amount: 2000 }]);
  return { ...b, ...s, number: 'S-0001', payments: [{ method: 'cash', amount: 2000 }], pointsEarned: 12 };
};

describe('receipt.render', () => {
  test('inr groups digits the Indian way', () => {
    expect(receipt.inr(999)).toBe('999'); expect(receipt.inr(1234)).toBe('1,234'); expect(receipt.inr(1234567)).toBe('12,34,567'); expect(receipt.inr(-1500)).toBe('-1,500');
  });
  test.each([32, 48])('no line is longer than %i columns and only plain letters are used', (width) => {
    const t = receipt.render(saved(), { name: 'Glow Salon', address: '12 Main Road, Puducherry', gstin: '34ABCDE1234F1Z5' }, { width, at: '01-11-2026 10:30' });
    for (const row of t.split('\n')) expect(row.length).toBeLessThanOrEqual(width);
    expect(/[^\x20-\x7e\n]/.test(t)).toBe(false);
  });
  test('shows tax split, total, payment and change', () => {
    const b = saved();
    const t = receipt.render(b, { name: 'Glow Salon', gstin: '34ABCDE1234F1Z5' }, { at: 'x' });
    expect(t).toContain('CGST'); expect(t).toContain('SGST'); expect(t).toContain(`TOTAL`); expect(t).toContain('Change'); expect(t).toContain('GSTIN 34ABCDE1234F1Z5');
    expect(t).toContain(`Rs ${receipt.inr(b.total)}`);
  });
  test('plain bill hides GST lines and the GSTIN', () => {
    const b = bill.compute({ lines: [{ name: 'Tea', unitPrice: 20, qty: 1 }] });
    const t = receipt.render({ ...b, ...bill.settle(b.total, [{ method: 'upi', amount: 20 }]), number: 'S-2', payments: [{ method: 'upi', amount: 20 }] }, { name: 'Cafe', gstin: '34ABCDE1234F1Z5' });
    expect(t).not.toContain('GST'); expect(t).toContain('UPI');
  });
  test('pay later bill shows the balance due; returned bill is marked', () => {
    const b = bill.compute({ lines: [{ name: 'Rice', unitPrice: 500, qty: 1 }] });
    const t = receipt.render({ ...b, ...bill.settle(b.total, [{ method: 'credit', amount: 500 }]), number: 'S-3', payments: [{ method: 'credit', amount: 500 }] }, { name: 'Mart' });
    expect(t).toContain('Pay later');
    expect(receipt.render({ ...b, number: 'S-4', status: 'returned', payments: [] }, { name: 'Mart' })).toContain('RETURNED');
  });
  test('Tamil letters become ? instead of garbage; wrong width and empty bill are refused', () => {
    const b = bill.compute({ lines: [{ name: 'முடி வெட்டு', unitPrice: 100, qty: 1 }] });
    expect(receipt.render({ ...b, number: 'S-5', payments: [] }, { name: 'Shop' })).toContain('?');
    expect(throwsCode(() => receipt.render(saved(), { name: 'x' }, { width: 40 }), 'RECEIPT_INVALID')).toBe(true);
    expect(throwsCode(() => receipt.render({ lines: [] }, { name: 'x' }), 'RECEIPT_INVALID')).toBe(true);
    expect(throwsCode(() => receipt.render(saved(), {}), 'RECEIPT_INVALID')).toBe(true);
  });
});
