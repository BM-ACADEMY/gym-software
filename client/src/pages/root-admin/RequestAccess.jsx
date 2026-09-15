import { useEffect, useState } from 'react';
import { Check, UserPlus, X } from 'lucide-react';
import apiClient from '../../api/client';
import Badge from '../../components/ui/Badge';

const STATUS_TONE = { pending: 'amber', approved: 'green', rejected: 'red' };
const PERMISSION_LEVELS = ['full', 'support', 'billing'];

const RequestAccess = () => {
  const [requests, setRequests] = useState([]);
  const [statusFilter, setStatusFilter] = useState('pending');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [permissionByRequest, setPermissionByRequest] = useState({});

  const fetchRequests = async () => {
    try {
      setLoading(true);
      const res = await apiClient.get('/root-admin/request-access', { params: { status: statusFilter } });
      setRequests(res.data.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load requests');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchRequests(); }, [statusFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  const approve = async (request) => {
    try {
      await apiClient.patch(`/root-admin/request-access/${request._id}/approve`, { permissionLevel: permissionByRequest[request._id] || 'full' });
      await fetchRequests();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to approve');
    }
  };

  const reject = async (request) => {
    try {
      await apiClient.patch(`/root-admin/request-access/${request._id}/reject`);
      await fetchRequests();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to reject');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6 sm:p-8">
      <div className="mx-auto max-w-4xl">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Request Access</h1>
          <p className="mt-1 text-gray-500">Internal team members requesting a Root Admin login.</p>
        </div>

        {error && <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

        <div className="mt-6 flex gap-2">
          {['pending', 'approved', 'rejected'].map((s) => (
            <button key={s} onClick={() => setStatusFilter(s)} className={`rounded-full px-3 py-1.5 text-sm font-medium capitalize ${statusFilter === s ? 'bg-teal-600 text-white' : 'border border-gray-200 text-gray-600'}`}>{s}</button>
          ))}
        </div>

        <div className="mt-4 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
          <div className="divide-y divide-gray-100">
            {loading ? (
              <p className="p-8 text-center text-sm text-gray-400">Loading...</p>
            ) : requests.length === 0 ? (
              <div className="flex flex-col items-center gap-3 px-6 py-16 text-gray-400"><UserPlus className="h-6 w-6" /><p className="text-sm">No {statusFilter} requests.</p></div>
            ) : requests.map((r) => (
              <div key={r._id} className="flex flex-wrap items-center gap-4 p-5">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-gray-900">{r.name}</p>
                  <p className="text-xs text-gray-500">{r.email || r.phone} · requested {new Date(r.createdAt).toLocaleDateString()}</p>
                </div>
                {r.status === 'pending' ? (
                  <div className="flex items-center gap-2">
                    <select value={permissionByRequest[r._id] || 'full'} onChange={(e) => setPermissionByRequest({ ...permissionByRequest, [r._id]: e.target.value })} className="rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs">
                      {PERMISSION_LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
                    </select>
                    <button onClick={() => approve(r)} className="inline-flex items-center gap-1 rounded-lg bg-teal-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-teal-700"><Check className="h-3.5 w-3.5" />Approve</button>
                    <button onClick={() => reject(r)} className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50"><X className="h-3.5 w-3.5" />Reject</button>
                  </div>
                ) : (
                  <Badge tone={STATUS_TONE[r.status]}>{r.status}{r.permissionLevel ? ` · ${r.permissionLevel}` : ''}</Badge>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default RequestAccess;
