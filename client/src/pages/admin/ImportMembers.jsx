import { useState } from 'react';
import { Upload, Download, CheckCircle2, AlertTriangle, Loader2 } from 'lucide-react';
import apiClient from '../../api/client';
import { TEMPLATE_CSV } from '../../utils/csv';
import { readSpreadsheet } from '../../utils/spreadsheet';

const downloadTemplate = () => {
  const url = URL.createObjectURL(new Blob([TEMPLATE_CSV], { type: 'text/csv' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = 'gymdesk-members-template.csv';
  a.click();
  URL.revokeObjectURL(url);
};

const ImportMembers = () => {
  const [rows, setRows] = useState(null);
  const [fileName, setFileName] = useState('');
  const [preview, setPreview] = useState(null);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const onFile = async (e) => {
    const file = e.target.files?.[0];
    setError(''); setPreview(null); setResult(null); setRows(null);
    if (!file) return;
    setFileName(file.name);
    setBusy(true);
    try {
      const parsed = await readSpreadsheet(file);
      if (!parsed.length) throw new Error('The file has no member rows.');
      setRows(parsed);
      const { data } = await apiClient.post('/admin/members/import', { rows: parsed, commit: false });
      setPreview(data.data);
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Could not read the file.');
    } finally {
      setBusy(false);
    }
  };

  const confirm = async () => {
    setBusy(true); setError('');
    try {
      const { data } = await apiClient.post('/admin/members/import', { rows, commit: true });
      setResult(data.data);
      setPreview(null);
    } catch (err) {
      setError(err.response?.data?.message || 'Import failed. Nothing was changed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-4 sm:p-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Import members</h1>
        <p className="mt-1 text-gray-600">Bring your existing members from Excel or CSV. We check everything first, and nothing is saved until you confirm.</p>
      </div>

      <div className="rounded-2xl border border-gray-200 p-6">
        <ol className="list-decimal space-y-1 pl-5 text-sm text-gray-700">
          <li>Download the template, or use your own sheet. Columns we understand: Name, Phone, Email, Gender, Plan, Start Date, Expiry Date, Device ID.</li>
          <li>Name and Phone are required. Use dates like 15/03/2027.</li>
          <li>If you only know the start date and the plan, we work out the expiry.</li>
        </ol>
        <div className="mt-5 flex flex-wrap gap-3">
          <button onClick={downloadTemplate} className="inline-flex items-center gap-2 rounded-xl border border-gray-300 px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50"><Download className="h-4 w-4" />Download template</button>
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-700">
            <Upload className="h-4 w-4" />Choose file
            <input type="file" accept=".csv,.xlsx" className="hidden" onChange={onFile} />
          </label>
          {fileName && <span className="self-center text-sm text-gray-500">{fileName}</span>}
        </div>
      </div>

      {busy && <p className="flex items-center gap-2 text-sm text-gray-600"><Loader2 className="h-4 w-4 animate-spin" />Working...</p>}
      {error && <div className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{error}</div>}

      {preview && (
        <div className="space-y-4 rounded-2xl border border-gray-200 p-6">
          <h2 className="text-lg font-bold">Check before importing</h2>
          <ul className="space-y-1 text-sm">
            <li className="flex items-center gap-2 text-green-700"><CheckCircle2 className="h-4 w-4" />{preview.willCreate} members ready to import</li>
            {preview.skippedExisting > 0 && <li className="text-gray-600">{preview.skippedExisting} already in your gym (same phone), they will be skipped</li>}
            {preview.errorCount > 0 && <li className="flex items-center gap-2 text-amber-700"><AlertTriangle className="h-4 w-4" />{preview.errorCount} rows have problems and will be skipped</li>}
            {preview.unknownPlans.length > 0 && <li className="text-amber-700">Plans not found in your gym: {preview.unknownPlans.join(', ')}. Those members are imported without a plan.</li>}
            {preview.unknownColumns.length > 0 && <li className="text-gray-500">Ignored columns: {preview.unknownColumns.join(', ')}</li>}
          </ul>
          {preview.errors.length > 0 && (
            <div className="max-h-56 overflow-auto rounded-lg border border-gray-200 text-sm">
              <table className="w-full text-left">
                <thead className="bg-gray-50 text-gray-600"><tr><th className="p-2">Row</th><th className="p-2">Name</th><th className="p-2">Problem</th></tr></thead>
                <tbody>{preview.errors.map((e, i) => <tr key={i} className="border-t border-gray-100"><td className="p-2">{e.row}</td><td className="p-2">{e.name || '-'}</td><td className="p-2">{e.message}</td></tr>)}</tbody>
              </table>
            </div>
          )}
          <button disabled={busy || preview.willCreate === 0} onClick={confirm} className="rounded-xl bg-teal-600 px-5 py-3 text-sm font-bold text-white hover:bg-teal-700 disabled:opacity-50">Import {preview.willCreate} members</button>
        </div>
      )}

      {result && (
        <div className="rounded-2xl border border-green-200 bg-green-50 p-6 text-green-800">
          <p className="flex items-center gap-2 font-bold"><CheckCircle2 className="h-5 w-5" />{result.created} members imported.</p>
          <p className="mt-1 text-sm">Open Members to see them. Turn on WhatsApp reminders in Settings so renewals go out by themselves.</p>
        </div>
      )}
    </div>
  );
};

export default ImportMembers;
