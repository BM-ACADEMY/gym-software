const X = require('../src/extract');
const code = async (p) => { try { await p; } catch (e) { return e.code; } return 'none'; };
const pdf = Buffer.from('%PDF-1.4 fake'); const zip = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0, 0, 0, 0, 1]);
const LONG = 'Ravi Kumar Java developer with five years of experience in banking software and cloud work.';
describe('resume file reading', () => {
  test('detects type by content, not by file name', () => {
    expect(X.detectType(pdf)).toBe('pdf'); expect(X.detectType(zip)).toBe('docx'); expect(X.detectType(Buffer.from('MZ\x90\x00 an exe file'))).toBeNull(); expect(X.detectType(Buffer.from('hi'))).toBeNull();
  });
  test('reads pdf and docx through the readers and tidies the text', async () => {
    const r = await X.extractText(pdf, { pdf: async () => ({ text: LONG + '\n\n\n\n\u0000  extra   spaces' }) });
    expect(r.type).toBe('pdf'); expect(r.text).toMatch(/Ravi Kumar/); expect(r.text).not.toMatch(/\n\n\n/); expect(r.text).not.toMatch(/\u0000/);
    const d = await X.extractText(zip, { mammoth: { extractRawText: async () => ({ value: LONG }) } });
    expect(d.type).toBe('docx');
  });
  test('refuses wrong types, scanned files, unreadable files', async () => {
    expect(await code(X.extractText(Buffer.from('MZ\x90\x00 an exe file')))).toBe('FILE_TYPE');
    expect(await code(X.extractText(pdf, { pdf: async () => ({ text: '  ' }) }))).toBe('FILE_NO_TEXT');
    expect(await code(X.extractText(pdf, { pdf: async () => { throw new Error('bad xref'); } }))).toBe('FILE_UNREADABLE');
  });
  test('missing reader library gives a clear code', async () => {
    const e = new Error('x'); e.code = 'MODULE_NOT_FOUND';
    expect(await code(X.extractText(pdf, { pdf: async () => { throw e; } }))).toBe('READER_MISSING');
  });
  test('base64 size and emptiness checks', async () => {
    expect(() => X.fromBase64('')).toThrow(); expect(() => X.fromBase64('A'.repeat(6 * 1024 * 1024))).toThrow();
    expect(X.fromBase64('data:application/pdf;base64,' + pdf.toString('base64')).slice(0, 5).toString()).toBe('%PDF-');
  });
});
