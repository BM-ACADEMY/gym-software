const { bill, billHtml } = require('../src');

const saved = () => {
  const b = bill.compute({ lines: [{ name: 'முடி வெட்டு', unitPrice: 1000, qty: 1, gstRate: 18 }, { name: 'Shampoo <b>', unitPrice: 250, qty: 2, gstRate: 18 }], taxMode: 'gst_exclusive' });
  const s = bill.settle(b.total, [{ method: 'cash', amount: 2000 }]);
  return { ...b, ...s, number: 'S-0001', payments: [{ method: 'cash', amount: 2000 }] };
};
const throwsCode = (fn, code) => { try { fn(); } catch (e) { return e.code === code; } return false; };

describe('billHtml.render', () => {
  test('keeps Tamil letters, shows GST split, total and change', () => {
    const t = billHtml.render(saved(), { name: 'Glow Salon', gstin: '34ABCDE1234F1Z5' }, { size: 'A4', at: '02-11-2026 10:30', lang: 'ta' });
    expect(t).toContain('முடி வெட்டு'); expect(t).toContain('CGST'); expect(t).toContain('TOTAL'); expect(t).toContain('Change'); expect(t).toContain('GSTIN 34ABCDE1234F1Z5'); expect(t).toContain('lang="ta"');
  });
  test('escapes shop, item and customer text and loads nothing from outside', () => {
    const t = billHtml.render(saved(), { name: '<script>alert(1)</script>' }, { customerName: '"><img src=x onerror=1>' });
    expect(t).not.toContain('<script>'); expect(t).not.toContain('<img'); expect(t).toContain('Shampoo &lt;b&gt;'); expect(/https?:\/\//.test(t)).toBe(false);
  });
  test('plain bill hides GST and GSTIN; pay later shows balance due; returned bill is stamped', () => {
    const b = bill.compute({ lines: [{ name: 'Rice', unitPrice: 500, qty: 1 }] });
    const t = billHtml.render({ ...b, ...bill.settle(b.total, [{ method: 'credit', amount: 500 }]), number: 'S-3', payments: [{ method: 'credit', amount: 500 }] }, { name: 'Mart', gstin: '34ABCDE1234F1Z5' });
    expect(t).not.toContain('GST'); expect(t).toContain('Pay later');
    expect(billHtml.render({ ...b, number: 'S-4', status: 'returned', payments: [] }, { name: 'Mart' })).toContain('RETURNED');
  });
  test('bad size, empty bill and missing shop name are refused', () => {
    expect(throwsCode(() => billHtml.render(saved(), { name: 'X' }, { size: 'A3' }), 'BILL_HTML_INVALID')).toBe(true);
    expect(throwsCode(() => billHtml.render({ lines: [] }, { name: 'X' }), 'BILL_HTML_INVALID')).toBe(true);
    expect(throwsCode(() => billHtml.render(saved(), {}), 'BILL_HTML_INVALID')).toBe(true);
  });
});
