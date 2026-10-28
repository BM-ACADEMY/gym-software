const { parseCsv, parseItems, parseCustomers } = require('../src/csvImport');

describe('csv text', () => {
  test('quotes, doubled quotes, commas inside, CRLF, BOM', () => {
    const rows = parseCsv('﻿Name,Note\r\n"Dal, toor","say ""hi"""\r\nRice,ok\r\n');
    expect(rows).toEqual([['Name', 'Note'], ['Dal, toor', 'say "hi"'], ['Rice', 'ok']]);
  });
  test('semicolon and tab files from some exports', () => {
    expect(parseCsv('a;b\n1;2')).toEqual([['a', 'b'], ['1', '2']]);
    expect(parseCsv('a\tb\n1\t2')).toEqual([['a', 'b'], ['1', '2']]);
  });
  test('blank lines are skipped', () => { expect(parseCsv('a,b\n\n1,2\n,\n')).toEqual([['a', 'b'], ['1', '2']]); });
});

describe('items import', () => {
  const file = 'Item Name,Barcode,Selling Price,GST %,Opening Stock,Expiry Date,Cost Price\n'
    + 'Toor dal 1 kg,8901,Rs 160,5%,40,15/03/2027,140\n'
    + 'Parle-G,8902,10,18,120,,8\n'
    + 'Bad price,8903,abc,5,1,,\n'
    + 'Bad gst,8904,10,7,1,,\n'
    + 'Same barcode,8901,12,5,1,,\n'
    + 'Bad date,8905,10,5,1,31/02/2027,\n';
  test('reads common header names and returns good rows plus clear errors', () => {
    const r = parseItems(file);
    expect(r.ok.map((x) => x.name)).toEqual(['Toor dal 1 kg', 'Parle-G']);
    expect(r.ok[0].price).toBe(160); expect(r.ok[0].gstRate).toBe(5); expect(r.ok[0].qty).toBe(40); expect(r.ok[0].cost).toBe(140);
    expect(r.ok[0].expiresAt.toISOString().slice(0, 10)).toBe('2027-03-15');
    expect(r.errors.map((e) => e.row)).toEqual([4, 5, 6, 7]);
    expect(r.errors[0].message).toMatch(/Price/);
    expect(r.errors[1].message).toMatch(/GST/);
    expect(r.errors[2].message).toMatch(/twice/);
    expect(r.errors[3].message).toMatch(/Expiry/);
  });
  test('missing required columns gives one helpful message', () => {
    const r = parseItems('foo,bar\n1,2');
    expect(r.ok).toEqual([]); expect(r.errors[0].message).toMatch(/name column and a price column/);
  });
  test('too many rows in one request is refused', () => {
    const big = 'name,price\n' + Array.from({ length: 1001 }, (_, i) => `x${i},1`).join('\n');
    expect(parseItems(big).errors[0].message).toMatch(/Too many rows/);
  });
});

describe('customers import', () => {
  const file = 'Customer Name,Mobile,Udhaar,Points\n'
    + 'Lakshmi,+91 98765 00101,340,120\n'
    + 'Murugan,09876500102,4800,\n'
    + 'No Phone Owes,,500,\n'
    + 'Bad Phone,12345,0,\n'
    + 'Dup,9876500101,0,\n'
    + 'Walk-in,,,\n';
  test('normalises phones, keeps opening credit and points, flags problems', () => {
    const r = parseCustomers(file);
    expect(r.ok.map((x) => x.name)).toEqual(['Lakshmi', 'Murugan', 'Walk-in']);
    expect(r.ok[0].phone).toBe('9876500101'); expect(r.ok[0].credit).toBe(340); expect(r.ok[0].points).toBe(120);
    expect(r.ok[1].phone).toBe('9876500102');
    expect(r.errors.map((e) => e.row)).toEqual([4, 5, 6]);
    expect(r.errors[0].message).toMatch(/needs a phone/);
    expect(r.errors[1].message).toMatch(/10-digit/);
    expect(r.errors[2].message).toMatch(/twice/);
  });
});
