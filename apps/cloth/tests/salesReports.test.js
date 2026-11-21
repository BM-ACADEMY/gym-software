const R = require('../src/salesReports');
const bills = [
  { number: 'CL1', date: '2026-11-10', at: '2026-11-10T05:00:00Z', status: 'paid', total: 1050, taxable: 1000, gst: 50, discount: 0, customerId: 'c1', lines: [{ name: 'Kurta M Blue', qty: 1, net: 1000, staffId: 's1' }] },
  { number: 'CL2', date: '2026-11-10', at: '2026-11-10T05:20:00Z', status: 'paid', total: 1800, taxable: 1800, gst: 0, discount: 100, lines: [{ name: 'Kurta M Blue', qty: 1, net: 900, staffId: 's2' }, { name: 'Shirt L White', qty: 2, net: 900 }] },
  { number: 'CL3', date: '2026-11-11', at: '2026-11-11T14:30:00Z', status: 'returned', total: 500, taxable: 500, gst: 0, discount: 0, lines: [{ name: 'Kurta M Blue', qty: 1, net: 500, staffId: 's1' }] },
  { number: 'CL4', date: '2026-11-11', at: 'bad', status: 'paid', total: 300, taxable: 300, gst: 0, discount: 0, lines: [] },
];
describe('sales by item, staff and hour; Tally-style CSV (CLO-08)', () => {
  test('by item: biggest first, returned bills left out', () => {
    const r = R.breakdown(bills, 'item'); expect(r[0]).toEqual({ key: 'Kurta M Blue', pieces: 2, amount: 1900 }); expect(r[1]).toEqual({ key: 'Shirt L White', pieces: 2, amount: 900 });
  });
  test('by staff: lines with no staff are grouped, not lost', () => {
    const r = R.breakdown(bills, 'staff'); expect(r.find((x) => x.key === 's1').amount).toBe(1000); expect(r.find((x) => x.key === 's2').amount).toBe(900); expect(r.find((x) => x.key === 'No staff on the line').amount).toBe(900);
  });
  test('by hour: India time, bad time ignored', () => {
    const r = R.breakdown(bills, 'hour'); expect(r).toEqual([{ key: '10:30'.slice(0, 2) + ':00', bills: 2, total: 2850 }]);
    expect(R.istHour('2026-11-10T18:30:00Z')).toBe(0); expect(R.istHour('x')).toBe(null);
  });
  test('report carries a plain note and currency', () => { expect(R.report(bills, 'item').note).toMatch(/before GST/); expect(R.report(bills, 'hour').currency).toBe('INR'); });
  test('Tally-style CSV: one row per bill, returned marked, names looked up, formula-safe', () => {
    const csv = R.tallyCsv(bills, { names: { c1: '=HYPERLINK("x")' } }).split('\n');
    expect(csv[0]).toBe('date,voucher_no,voucher_type,party,taxable,gst,discount,total,status'); expect(csv.length).toBe(5);
    expect(csv[1].includes("'=HYPERLINK")).toBe(true); expect(csv[3].includes('returned, check with CA')).toBe(true); expect(csv[2].includes('Cash sale')).toBe(true);
  });
});
