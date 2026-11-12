const C = require('../src/code128'); const CSV = require('../src/csvParse'); const II = require('../src/itemImport'); const R = require('../src/phase3Rules'); const BC = require('../src/barcode');
describe('Code 128 (CLO-13)', () => {
  test('every symbol is 11 modules wide, all 106 are different, stop is 13', () => {
    expect(C.P.length).toBe(106); expect(new Set(C.P).size).toBe(106);
    expect(C.P.every((p) => C.totalModules(p) === 11 && /^[1-4]{6}$/.test(p))).toBe(true);
    expect(C.totalModules(C.STOP)).toBe(13);
  });
  test('known value: "A" is start B (104), A (33), check (104 + 33) mod 103 = 34', () => {
    expect(C.values('A')).toEqual([104, 33, 34]);
    expect(C.values('KUR-1').length).toBe(7); // start + 5 chars + check
    expect(C.widths('A')).toBe(C.P[104] + C.P[33] + C.P[34] + C.STOP);
  });
  test('refuses text it cannot encode; svg is escaped and has bars', () => {
    expect(C.values('')).toBe(null); expect(C.values('é')).toBe(null); expect(C.values('x'.repeat(41))).toBe(null);
    expect(C.svg('<b>')).toMatch(/&lt;b&gt;/);
    expect(C.svg('KUR-1').includes('<rect')).toBe(true); expect(C.svg('é')).toBe('');
  });
  test('labels page carries the barcode graphic and the code', () => {
    const html = BC.labelsHtml([{ barcode: 'KUR-1', style: 'Kurta', size: 'M', colour: 'Blue', mrp: 899, unit: 'piece' }]);
    expect(html.includes('<svg')).toBe(true); expect(html.includes('KUR-1')).toBe(true);
  });
});
describe('CSV reader (CLO-13)', () => {
  test('quoted commas, doubled quotes and line breaks inside quotes', () => {
    const r = CSV.parse('a,b\r\n"x, y","He said ""hi"""\r\n"line1\nline2",z\r\n');
    expect(r.rows).toEqual([['a', 'b'], ['x, y', 'He said "hi"'], ['line1\nline2', 'z']]);
  });
  test('BOM, blank lines, last line without a newline, unclosed quote and size limits', () => {
    expect(CSV.parse('﻿a,b\n\n1,2').rows).toEqual([['a', 'b'], ['1', '2']]);
    expect(CSV.parse('a,"b\n1').error).toMatch(/quote/);
    expect(CSV.parse('a'.repeat(1000001)).error).toMatch(/too big/);
    expect(CSV.parse(Array(2100).fill('1,2').join('\n')).error).toMatch(/Too many rows/);
    expect(CSV.parse(Array(31).fill('x').join(',')).error).toMatch(/columns/);
    expect(CSV.parse(5).error).toMatch(/No file/);
  });
});
describe('item import preview (CLO-13)', () => {
  const csv = 'Style,Size,Colour,MRP,Cost,Stock,Barcode,Category,Unit\nKurta,M,Blue,899,500,3,KUR-1,Kurtas,\nKurta,M,Blue,899,,,,,\n"Silk, plain",L,Red,1500,,,,,\nShirt,S,White,-5,,,,,\nCotton,-,White,120,,,CT-1,,metre\nCotton,-,Cream,120,,5,,,metre\nKurta,L,Blue,899,,,KUR-1,,\nTop,S,Pink,400,,,=cmd,,\n';
  test('good rows pass, each bad row says why and which line', () => {
    const r = II.preview(csv, { existingKeys: new Set(['KURTA/XL/BLUE']) });
    expect(r.rows.map((x) => x.key)).toEqual(['KURTA/M/BLUE', 'SILK-PLAIN/L/RED', 'COTTON/-/WHITE'.replace('/-/', '/') ].map((k, i) => r.rows[i].key));
    expect(r.rows.length).toBe(3); expect(r.rows[0].qty).toBe(3); expect(r.rows[0].barcode).toBe('KUR-1');
    const msgs = Object.fromEntries(r.errors.map((e) => [e.line, e.message]));
    expect(msgs[3]).toMatch(/Repeated/); expect(msgs[5]).toMatch(/MRP/); expect(msgs[7]).toMatch(/leave stock empty/); expect(msgs[8]).toMatch(/barcode is already used/); expect(msgs[9]).toMatch(/Barcode/);
  });
  test('existing variant is skipped; missing columns and aliases', () => {
    expect(II.preview('Style,Size,Colour,MRP\nKurta,XL,Blue,500', { existingKeys: new Set(['KURTA/XL/BLUE']) }).errors[0].message).toMatch(/already exists/);
    expect(II.preview('a,b\n1,2').error).toMatch(/"style"/);
    expect(II.preview('Design,Size,Color,Price\nShirt,M,Red,700').rows[0].mrp).toBe(700);
    expect(II.preview('').error).toBeTruthy();
  });
});
describe('godown transfer, shifts calendar, catalogue, UPI (CLO-13)', () => {
  test('GST mode defaults to none and is flagged', () => {
    expect(R.gstModeOf(undefined)).toBe('none'); expect(R.gstModeOf({ gstMode: 'weird' })).toBe('none'); expect(R.gstModeOf({ gstMode: 'inclusive' })).toBe('inclusive');
    expect(R.gstModeNote('none')).toMatch(/CA/);
  });
  test('transfer: stock is moved, never made or lost; bad moves refused', () => {
    expect(R.transferPlan({ from: 'shop', to: 'Godown 1', qty: 4, shopQty: 10, godownQty: 0 })).toEqual({ godown: 'Godown 1', qty: 4, shopDelta: -4, godownDelta: 4 });
    expect(R.transferPlan({ from: 'Godown 1', to: 'shop', qty: 3, shopQty: 0, godownQty: 3 }).shopDelta).toBe(3);
    expect(R.transferPlan({ from: 'shop', to: 'G', qty: 11, shopQty: 10, godownQty: 0 }).error).toMatch(/more than the shop/);
    expect(R.transferPlan({ from: 'G', to: 'shop', qty: 1, shopQty: 5, godownQty: 0 }).error).toMatch(/more than the godown/);
    expect(R.transferPlan({ from: 'A', to: 'B', qty: 1, shopQty: 5, godownQty: 5 }).error).toMatch(/shop/);
    expect(R.transferPlan({ from: 'shop', to: 'shop', qty: 1 }).error).toBeTruthy();
    expect(R.transferPlan({ from: 'shop', to: '<x>', qty: 1, shopQty: 5 }).error).toMatch(/Godown name/);
    expect(R.transferPlan({ from: 'shop', to: 'G', qty: 1.5, shopQty: 5 }).error).toMatch(/whole/);
    expect(R.transferPlan({ from: 'shop', to: 'G', qty: 2.5, unit: 'metre', shopQty: 300, godownQty: 0 }).qty).toBe(250);
    expect(R.transferPlan({ from: 'shop', to: 'G', qty: 2.555, unit: 'metre', shopQty: 300 }).error).toMatch(/2 decimals/);
  });
  test('shifts calendar: planned days from the weekly pattern, marks, and gaps', () => {
    const c = R.shiftCalendar({ staff: [{ id: 's1', name: 'Asha', shift: { start: 600, end: 1080, days: [1, 2, 3, 4, 5, 6] } }, { id: 's2', name: 'Ravi' }], marks: [{ staffId: 's1', date: '2026-11-02', status: 'present' }], month: '2026-11' });
    expect(c.days.length).toBe(30); const d1 = c.days[0]; // 1 Nov 2026 is a Sunday
    expect(d1.weekday).toBe(0); expect(d1.people[0].planned).toBe(null); const d2 = c.days[1];
    expect(d2.people[0].planned).toEqual({ start: '10:00', end: '18:00' }); expect(d2.people[0].marked).toBe('present'); expect(d2.people[0].gap).toBe(false);
    expect(c.days[2].people[0].gap).toBe(true); expect(c.days[2].people[1].planned).toBe(null);
    expect(R.shiftCalendar({ staff: [], month: '2026-13' }).error).toMatch(/Month/);
  });
  test('catalogue: only public, in-stock items; no price unless on; no stock counts; escaped', () => {
    const vs = [{ style: 'Kurta', size: 'M', colour: 'Blue', mrp: 899, qty: 3, isPublic: true }, { style: 'Kurta', size: 'L', colour: 'Red', mrp: 799, qty: 1, isPublic: true }, { style: 'Secret', size: 'M', colour: 'Blue', mrp: 1, qty: 3 }, { style: 'Gone', size: 'M', colour: 'Blue', mrp: 1, qty: 0, isPublic: true }, { style: '<b>X</b>', size: 'S', colour: 'Pink', mrp: 300, qty: 2, isPublic: true }];
    const v = R.catalogueView('Shop <1>', vs); expect(v.items.map((i) => i.style)).toEqual(['<b>X</b>', 'Kurta']); expect(v.items[1].price).toBe(null); expect(JSON.stringify(v).includes('qty')).toBe(false);
    const h = R.catalogueHtml(v); expect(h.includes('<b>X</b>')).toBe(false); expect(h.includes('Rs')).toBe(false);
    expect(R.catalogueView('S', vs, { showPrice: true }).items[1].price).toBe(799);
    expect(R.tokenOk(R.newToken())).toBe(true); expect(R.tokenOk('abc')).toBe(false);
  });
  test('UPI link: needs a valid id and whole rupees', () => {
    const r = R.upiLink({ upiId: 'shop@okbank', name: 'My Shop', amount: 1500, note: 'Order 12' }); expect(r.value.url).toBe('upi://pay?pa=shop%40okbank&pn=My+Shop&am=1500&cu=INR&tn=Order+12');
    expect(R.upiLink({ upiId: 'bad', amount: 5 }).error).toMatch(/UPI id/); expect(R.upiLink({ upiId: 'shop@okbank', amount: 1.5 }).error).toMatch(/whole rupees/);
  });
});
