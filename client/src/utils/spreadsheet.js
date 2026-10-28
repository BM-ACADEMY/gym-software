import { parseCsv } from './csv';

const pad = (n) => String(n).padStart(2, '0');

// Excel date cells arrive as Date objects. Date-only cells: add 12 hours then read
// the UTC day, which is right whether the library used local or UTC midnight.
const dateOnly = (d) => {
  const x = new Date(d.getTime() + 12 * 60 * 60 * 1000);
  return `${pad(x.getUTCDate())}/${pad(x.getUTCMonth() + 1)}/${x.getUTCFullYear()}`;
};
// Date and time cells keep the wall-clock reading exactly as written in the sheet (UTC fields).
const dateTime = (d) => `${pad(d.getUTCDate())}/${pad(d.getUTCMonth() + 1)}/${d.getUTCFullYear()} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`;

// Reads a .csv or .xlsx file into rows of { header: value }.
export const readSpreadsheet = async (file, { withTime = false } = {}) => {
  if (/\.xlsx$/i.test(file.name)) {
    const { default: readXlsxFile } = await import('read-excel-file');
    const table = await readXlsxFile(file);
    if (table.length < 2) return [];
    const headers = table[0].map((h) => String(h ?? '').trim());
    const asText = withTime ? dateTime : dateOnly;
    return table.slice(1).map((r) => Object.fromEntries(headers.map((h, i) => {
      const v = r[i];
      return [h, v instanceof Date ? asText(v) : v ?? ''];
    })));
  }
  if (/\.csv$/i.test(file.name)) return parseCsv(await file.text());
  throw new Error('Please choose an Excel (.xlsx) or CSV file. For old .xls files, open in Excel and Save As .xlsx.');
};
