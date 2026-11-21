const { computePayslip } = require('../services/payroll/engine');
const { itemFor, cleanAdj, totals } = require('../services/payroll/item');
const { slipRows } = require('../services/payroll/slip');

describe('payroll maths', () => {
  test('no loss of pay: net equals gross', () => {
    const p = computePayslip({ gross: 20000, config: {} });
    expect(p.net).toBe(20000);
    expect(p.lop).toBe(0);
  });
  test('loss of pay is gross / 26 per day, rounded to the rupee', () => {
    expect(computePayslip({ gross: 26000, lopDays: 2, config: {} }).net).toBe(24000);
    expect(computePayslip({ gross: 20000, lopDays: 1, config: {} }).lop).toBe(769);
  });
  test('advance recovery never takes pay below zero and carries the rest forward', () => {
    const p = computePayslip({ gross: 10000, advanceDue: 15000, config: {} });
    expect(p.net).toBe(0);
    expect(p.advanceApplied).toBe(10000);
    expect(p.advanceCarriedForward).toBe(5000);
  });
  test('bad inputs are refused', () => {
    expect(() => computePayslip({ gross: -1, config: {} })).toThrow();
    expect(() => computePayslip({ gross: 1000.5, config: {} })).toThrow();
    expect(() => computePayslip({ gross: 1000, lopDays: 0.3, config: {} })).toThrow();
  });
});

describe('payslip item', () => {
  const staff = { _id: 's1', name: 'Ravi', baseSalary: 20000 };
  test('PT commission is added after deductions', () => {
    const it = itemFor(staff, 0, 0, [{ label: 'PT commission', kind: 'add', amount: 1500 }]);
    expect(it.payslip.net).toBe(21500);
  });
  test('fines cannot push pay below zero', () => {
    expect(() => itemFor(staff, 0, 0, [{ label: 'Fine', kind: 'deduct', amount: 25000 }])).toThrow(/more than the pay/);
  });
  test('adjustment amounts must be positive and limited in number', () => {
    expect(() => cleanAdj([{ label: 'x', kind: 'add', amount: 0 }])).toThrow();
    expect(() => cleanAdj(new Array(11).fill({ label: 'x', amount: 5 }))).toThrow();
    expect(() => cleanAdj('nope')).toThrow();
  });
  test('rows used by the PDF show salary, commission, loss of pay and advance', () => {
    const it = itemFor(staff, 2, 1000, [{ label: 'PT commission', kind: 'add', amount: 500 }]);
    const { earn, ded } = slipRows(it);
    expect(earn.map((r) => r[0])).toEqual(['Basic salary', 'PT commission']);
    expect(ded.map((r) => r[0])).toEqual(['Loss of pay (2 days)', 'Advance recovered']);
  });
  test('run totals add up', () => {
    const a = itemFor({ _id: 'a', name: 'A', baseSalary: 10000 }, 0, 0, []);
    const b = itemFor({ _id: 'b', name: 'B', baseSalary: 12000 }, 0, 0, [{ label: 'Bonus', kind: 'add', amount: 500 }]);
    expect(totals([a, b])).toEqual({ gross: 22500, net: 22500 });
  });
});
