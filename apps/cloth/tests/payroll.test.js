const P = require('../src/payrollRules');
describe('staff shifts, leave, commission, payslip (CLO-07)', () => {
  test('shift validation', () => {
    expect(P.validShift({ start: 600, end: 1260, days: [1, 2, 2, 3] }).value).toEqual({ start: 600, end: 1260, days: [1, 2, 3] });
    expect(P.validShift({ start: 700, end: 600, days: [1] }).error).toMatch(/before/); expect(P.validShift({ start: 600, end: 700, days: [] }).error).toMatch(/days/); expect(P.validShift({ start: 600, end: 700, days: [9] }).error).toMatch(/days/); expect(P.validShift(null).error).toMatch(/Shift/);
  });
  test('leave: allowance 12 a year, earlier months use it up, extra leave is unpaid', () => {
    const marks = [...Array(11).fill(0).map((_, i) => ({ date: `2026-0${(i % 9) + 1}-0${(i % 3) + 1}`, status: 'leave' })), { date: '2026-11-03', status: 'leave' }, { date: '2026-11-04', status: 'leave' }, { date: '2025-12-01', status: 'leave' }];
    const lv = P.leaveFor({ allowance: 12, marksYear: marks, month: '2026-11' });
    expect(lv.usedBefore).toBe(11); expect(lv.leftBefore).toBe(1); expect(lv.leaveThisMonth).toBe(2); expect(lv.paidThisMonth).toBe(1); expect(lv.unpaidThisMonth).toBe(1); expect(lv.leftAfter).toBe(0);
  });
  test('commission: staff rule beats default, percent on taxable, never above the line, returned bills left out, other staff ignored', () => {
    const rules = { default: { type: 'percent', value: 2 }, byStaff: { s1: { type: 'percent', value: 5 } } };
    const bills = [{ status: 'paid', lines: [{ staffId: 's1', taxable: 1000 }, { staffId: 's2', taxable: 1000 }] }, { status: 'returned', lines: [{ staffId: 's1', taxable: 5000 }] }, { status: 'paid', lines: [{ staffId: 's1', net: 333 }] }];
    expect(P.commissionOf(P.monthLines(bills), 's1', rules).amount).toBe(67); expect(P.commissionOf(P.monthLines(bills), 's2', rules).amount).toBe(20);
    expect(P.commissionOf(P.monthLines(bills), 's3', rules).amount).toBe(0); expect(P.commissionOf(P.monthLines(bills), 's1', {}).amount).toBe(0);
    expect(P.commissionOf([{ staffId: 's1', taxable: 30 }], 's1', { default: { type: 'flat', value: 50 } }).amount).toBe(30);
    expect(P.commissionOf([{ staffId: 's1', taxable: 100 }], 's1', { default: { type: 'percent', value: 150 } }).amount).toBe(0);
  });
  test('payslip adds salary after unpaid days and commission; html escapes names', () => {
    const marks = [{ date: '2026-11-02', status: 'absent' }, { date: '2026-11-05', status: 'leave' }];
    const p = P.payslip({ shop: 'My <Shop>', staff: { id: 's1', name: '<b>Ravi</b>', salary: 15000 }, month: '2026-11', marks, daysInMonth: 30, bills: [{ status: 'paid', lines: [{ staffId: 's1', taxable: 2000 }] }], rules: { default: { type: 'percent', value: 5 } } });
    expect(p.daysLost).toBe(1); expect(p.salaryPay).toBe(14500); expect(p.commission).toBe(100); expect(p.total).toBe(14600); expect(p.leave.paidThisMonth).toBe(1);
    const h = P.payslipHtml(p); expect(h.includes('<b>Ravi</b>')).toBe(false); expect(h.includes('Rs 14600')).toBe(true);
    expect(P.payslip({ staff: { id: 'x', name: 'A', salary: -5 }, month: '2026-11', marks: [], daysInMonth: 30 }).error).toMatch(/Salary/);
  });
});
