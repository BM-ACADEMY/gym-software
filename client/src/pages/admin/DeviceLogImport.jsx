import { useState } from 'react';
import { Upload, CheckCircle2, AlertTriangle, Loader2 } from 'lucide-react';
import apiClient from '../../api/client';
import { readSpreadsheet } from '../../utils/spreadsheet';

const DeviceLogImport = () => {
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
      const parsed = await readSpreadsheet(file, { withTime: true });
      if (!parsed.length) throw new Error('The file has no rows.');
      setRows(parsed);
      const { data } = await apiClient.post('/admin/attendance/device-log', { rows: parsed, commit: false });
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
      const { data } = await apiClient.post('/admin/attendance/device-log', { rows, commit: true });
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
        <h1 className="text-2xl font-bold text-gray-900">Import biometric device log</h1>
        <p className="mt-1 text-gray-600">Export the punch log from your fingerprint or card machine (CSV or Excel) and upload it here. Works with any brand that can export a file.</p>
      </div>

      <div className="rounded-2xl border border-gray-200 p-6 text-sm text-gray-700">
        <ol className="list-decimal space-y-1 pl-5">
          <li>First, enter each member's and staff member's <b>device ID</b> (the number on your machine) on their profile. Importing members with a Device ID column does this for you.</li>
          <li>Export the log from your device. We need two things per row: the user ID and the date and time.</li>
          <li>Upload it. We show you what will happen, and you confirm. Repeat punches within 30 minutes count once, and nothing is added twice if you upload the same file again.</li>
        </ol>
        <label className="mt-5 inline-flex cursor-pointer items-center gap-2 rounded-xl bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-700">
          <Upload className="h-4 w-4" />Choose file
          <input type="file" accept=".csv,.xlsx" className="hidden" onChange={onFile} />
        </label>
        {fileName && <span className="ml-3 text-gray-500">{fileName}</span>}
      </div>

      {busy && <p className="flex items-center gap-2 text-sm text-gray-600"><Loader2 className="h-4 w-4 animate-spin" />Working...</p>}
      {error && <div className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{error}</div>}

      {preview && (
        <div className="space-y-3 rounded-2xl border border-gray-200 p-6 text-sm">
          <h2 className="text-lg font-bold">Check before importing</h2>
          <p className="flex items-center gap-2 text-green-700"><CheckCircle2 className="h-4 w-4" />{preview.memberCheckIns} member check-ins and {preview.staffDays} staff days will be added</p>
          {preview.alreadyRecorded > 0 && <p className="text-gray-600">{preview.alreadyRecorded} punches are already in GymDesk and will be skipped</p>}
          {preview.repeatPunches > 0 && <p className="text-gray-600">{preview.repeatPunches} repeat punches within 30 minutes are counted once</p>}
          {preview.rowProblems > 0 && <p className="flex items-center gap-2 text-amber-700"><AlertTriangle className="h-4 w-4" />{preview.rowProblems} rows could not be read (for example row {preview.problemRows[0].row}: {preview.problemRows[0].message})</p>}
          {preview.unmatchedCount > 0 && (
            <div className="rounded-lg bg-amber-50 p-3 text-amber-900">
              <p className="font-medium">{preview.unmatchedCount} device IDs do not match anyone yet:</p>
              <p className="mt-1">{preview.unmatchedIds.map((u) => `${u.userId} (${u.punches})`).join(', ')}</p>
              <p className="mt-1 text-xs">Add these IDs on the member or staff profile and upload again. Nothing is lost.</p>
            </div>
          )}
          <button disabled={busy || (preview.memberCheckIns === 0 && preview.staffDays === 0)} onClick={confirm} className="rounded-xl bg-teal-600 px-5 py-3 font-bold text-white hover:bg-teal-700 disabled:opacity-50">Import now</button>
        </div>
      )}

      {result && (
        <div className="rounded-2xl border border-green-200 bg-green-50 p-6 text-green-800">
          <p className="flex items-center gap-2 font-bold"><CheckCircle2 className="h-5 w-5" />Done. {result.memberCheckIns} check-ins and {result.staffDays} staff days added.</p>
        </div>
      )}
    </div>
  );
};

export default DeviceLogImport;
