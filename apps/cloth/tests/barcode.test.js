const B = require('../src/barcode');
const vs = [
  { _id: 'v1', style: 'Kurta', size: 'M', colour: 'Blue', barcode: 'KUR-M-BL', mrp: 899, qty: 3 },
  { _id: 'v2', style: 'Cotton', size: '-', colour: 'White', barcode: 'FAB-COT', mrp: 120, qty: 5000, unit: 'metre' },
  { _id: 'v3', style: 'No code', size: 'S', colour: 'Red', mrp: 100, qty: 2 },
  { _id: 'v4', style: 'Bad', size: 'S', colour: 'Red', barcode: '=cmd|x', mrp: 100, qty: 2 },
  { _id: 'v5', style: 'Gone', size: 'S', colour: 'Red', barcode: 'GONE-1', mrp: 100, qty: 2, isActive: false },
];
describe('barcode, scan and fabric (CLO-06)', () => {
  test('barcode text is restricted so it is safe in labels and CSV', () => {
    expect(B.barcodeOk('KUR-M-BL')).toBe(true); expect(B.barcodeOk('=cmd|x')).toBe(false); expect(B.barcodeOk('')).toBe(false); expect(B.barcodeOk('a'.repeat(41))).toBe(false); expect(B.barcodeOk('<b>')).toBe(false);
  });
  test('metres to whole centimetres: 0.01 steps only, positive, max 500', () => {
    expect(B.metresToCm(2.5)).toBe(250); expect(B.metresToCm('0.05')).toBe(5); expect(B.metresToCm(2.505)).toBe(null); expect(B.metresToCm(0)).toBe(null); expect(B.metresToCm(-1)).toBe(null); expect(B.metresToCm(501)).toBe(null); expect(B.metresToCm('x')).toBe(null);
    expect(B.metresText(250)).toBe('2.5 m'); expect(B.metresText(300)).toBe('3 m'); expect(B.fabricAmount(120, 250)).toBe(300); expect(B.fabricAmount(99, 33)).toBe(33);
  });
  test('label rows: only variants with a safe barcode, copies follow stock (max 10), fabric prints one, active only', () => {
    const r = B.labelRows(vs); expect(r.length).toBe(4); expect(r.filter((x) => x.barcode === 'KUR-M-BL').length).toBe(3); expect(r.filter((x) => x.barcode === 'FAB-COT').length).toBe(1);
    expect(B.labelRows(vs, { copies: 2 }).length).toBe(4); expect(B.labelRows([vs[0]], { copies: 999 }).length).toBe(50);
  });
  test('labels csv and html are safe and carry the price', () => {
    const rows = B.labelRows([{ _id: 'x', style: '<script>', size: 'M', colour: 'Blue', barcode: 'A-1', mrp: 100, qty: 1 }]);
    const html = B.labelsHtml(rows, 'My <shop>'); expect(html.includes('<script>')).toBe(false); expect(html.includes('&lt;script&gt;')).toBe(true); expect(html.includes('Rs 100')).toBe(true);
    expect(B.labelsCsv(rows).split('\n')[0]).toBe('barcode,style,size,colour,mrp,unit,currency');
    const evil = B.labelsCsv([{ barcode: 'A', style: '=HYPERLINK("x")', size: 'M', colour: 'B', mrp: 1, unit: 'piece', currency: 'INR' }]); expect(evil.includes(',=HYPERLINK')).toBe(false);
  });
  test('scan: find by code, inactive ignored, line for pieces and for metres', () => {
    expect(B.findByBarcode(vs, ' KUR-M-BL ')._id).toBe('v1'); expect(B.findByBarcode(vs, 'GONE-1')).toBe(null); expect(B.findByBarcode(vs, '')).toBe(null);
    expect(B.lineFromScan(vs[0], {}).line).toEqual({ variantId: 'v1', qty: 1 }); expect(B.lineFromScan(vs[0], { qty: 2.5 }).error).toMatch(/whole number/);
    const f = B.lineFromScan(vs[1], { metres: 2.5 }); expect(f.line.qty).toBe(2.5); expect(f.cm).toBe(250); expect(B.lineFromScan(vs[1], { metres: 2.555 }).error).toMatch(/2 decimals/); expect(B.lineFromScan(null, {}).error).toMatch(/barcode/);
  });
});
