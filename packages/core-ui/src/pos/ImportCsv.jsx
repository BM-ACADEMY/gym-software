import { useState } from 'react';

// CSV import screen for items or customers. The app passes in `api` (signed-in client) and `basePath` (where the
// server router is mounted). The file is read on the device, sent in chunks of 500 rows, and nothing is saved until
// the owner presses Save after seeing the preview.
const CHUNK = 500;
const KINDS = { items: { label: 'Items and opening stock', hint: 'Columns it understands: item name, barcode, selling price, GST %, opening stock, cost price, unit, category, expiry date.' }, customers: { label: 'Customers and opening udhaar', hint: 'Columns it understands: customer name, mobile, udhaar / balance, points, email, notes.' } };

// Splits CSV text into chunks that each keep the header line. Quoted line breaks are respected.
export const splitCsv = (text, size = CHUNK) => {
  const lines = []; let cur = ''; let q = false;
  for (const ch of text.replace(/^﻿/, '')) { if (ch === '"') q = !q; if (ch === '\n' && !q) { lines.push(cur); cur = ''; } else cur += ch; }
  if (cur.trim()) lines.push(cur);
  const clean = lines.map((l) => l.replace(/\r$/, '')).filter((l) => l.trim() !== '');
  if (clean.length < 2) return [];
  const [head, ...rest] = clean; const out = [];
  for (let i = 0; i < rest.length; i += size) out.push([head, ...rest.slice(i, i + size)].join('\n'));
  return out;
};

const ImportCsv = ({ api, basePath = '/pos', kind = 'items' }) => {
  const [file, setFile] = useState(null);
  const [chunks, setChunks] = useState([]);
  const [report, setReport] = useState(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  const pick = async (e) => {
    const f = e.target.files?.[0]; setReport(null); setMsg('');
    if (!f) return;
    const text = await f.text(); const parts = splitCsv(text);
    setFile(f); setChunks(parts);
    if (!parts.length) setMsg('The file has no rows. The first line must be the column names.');
  };

  const run = async (commit) => {
    setBusy(true); setMsg('');
    const total = { willAdd: 0, added: 0, skipped: [], errors: [], preview: [], columnsRead: [] };
    try {
      for (let i = 0; i < chunks.length; i += 1) {
        const r = (await api.post(`${basePath}/import/${kind}`, { csv: chunks[i], commit })).data.data;
        const base = i * CHUNK; // keep row numbers meaningful across chunks
        total.willAdd += r.willAdd; total.added += r.added; total.columnsRead = r.columnsRead;
        total.skipped.push(...r.skipped.map((x) => ({ ...x, row: x.row + base }))); total.errors.push(...r.errors.map((x) => ({ ...x, row: x.row + base })));
        if (total.preview.length < 5) total.preview.push(...r.preview.slice(0, 5 - total.preview.length));
      }
      setReport({ ...total, committed: commit });
      if (commit) setMsg(`Saved ${total.added} row(s).`);
    } catch (err) { setMsg(err.response?.data?.message || 'Could not import. Nothing in the rows after this point was saved.'); }
    finally { setBusy(false); }
  };

  return (
    <div className="space-y-4 max-w-3xl">
      <h1 className="text-2xl font-bold text-gray-900">Import {KINDS[kind].label}</h1>
      <p className="text-sm text-gray-600">{KINDS[kind].hint} Export from Excel, Google Sheets, Vyapar or myBillBook as CSV. Rows already in your list are skipped, never changed.</p>
      <input type="file" accept=".csv,text/csv" onChange={pick} aria-label="Choose CSV file" />
      {file && chunks.length > 0 && <button type="button" disabled={busy} onClick={() => run(false)} className="px-4 py-2 rounded-lg border border-gray-300 text-sm font-semibold">{busy ? 'Checking...' : 'Check the file'}</button>}
      {report && (
        <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-2 text-sm">
          <p><b>{report.willAdd}</b> row(s) will be added. <b>{report.skipped.length}</b> already exist. <b>{report.errors.length}</b> need fixing.</p>
          {report.columnsRead.length > 0 && <p className="text-gray-500">Columns read: {report.columnsRead.join(', ')}</p>}
          {report.errors.slice(0, 20).map((x, i) => <p key={i} className="text-red-600">Row {x.row}: {x.message}</p>)}
          {report.errors.length > 20 && <p className="text-red-600">...and {report.errors.length - 20} more.</p>}
          {!report.committed && report.willAdd > 0 && <button type="button" disabled={busy} onClick={() => run(true)} className="px-4 py-2 rounded-lg bg-teal-600 text-white font-semibold">{busy ? 'Saving...' : `Save ${report.willAdd} row(s)`}</button>}
        </div>
      )}
      {msg && <p className="text-sm text-gray-700">{msg}</p>}
    </div>
  );
};

export default ImportCsv;
