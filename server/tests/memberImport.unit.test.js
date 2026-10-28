const I=require('../services/memberImport');
describe('import',()=>{
 test('headers and rows',()=>{
  const r=I.parseRows([
   {'Member Name':'Ravi','Mobile':'98765 43210','Valid Till':'15/01/2027','Plan':'Monthly','Gender':'M'},
   {'Member Name':'Sita','Mobile':'+91 9123456780','Valid Till':46000},
   {'Member Name':'','Mobile':'9999999999'},
   {'Member Name':'Bad','Mobile':'123'},
   {'Member Name':'Dup','Mobile':'9876543210'},
   {'Member Name':'BadDate','Mobile':'9000000001','Valid Till':'31/02/2027'},
   {},
  ]);
  expect(r.records.length).toBe(2);
  expect(r.errors.length).toBe(4);
  expect(r.records[0].phone).toBe('9876543210');
  expect(r.records[0].expiresAt.toISOString().slice(0,10)).toBe('2027-01-15');
  expect(r.records[0].gender).toBe('male');
  expect(r.records[1].phone).toBe('9123456780');
  expect(r.records[1].expiresAt.getUTCFullYear()).toBe(2025);
  expect(r.errors[3].message.includes('Expiry')).toBe(true);
 });
 test('fatal cases',()=>{
  expect(I.parseRows([]).fatal).toBe('The file has no rows');
  expect(I.parseRows([{Foo:'x'}]).fatal.includes('Name')).toBe(true);
  expect(I.parseRows([{Name:'x'}]).fatal.includes('Phone')).toBe(true);
 });
 test('expiry from plan',()=>{
  expect(I.resolveExpiry({startDate:new Date('2026-12-01T00:00:00Z')},{durationDays:30}).toISOString().slice(0,10)).toBe('2026-12-31');
  expect(I.resolveExpiry({},{durationDays:30})).toBe(undefined);
 });
});
