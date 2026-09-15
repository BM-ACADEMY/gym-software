import { useEffect, useState } from 'react';
import { Building2, LogIn, Power, Search, Trash2 } from 'lucide-react';
import apiClient from '../../api/client';
import Modal from '../../components/ui/Modal';
import Badge from '../../components/ui/Badge';

const Subscribers = () => {
  const [subscribers, setSubscribers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [platformPlans, setPlatformPlans] = useState([]);
  const [planSelection, setPlanSelection] = useState('');
  const [planSaving, setPlanSaving] = useState(false);

  const fetchSubscribers = async () => {
    try {
      setLoading(true);
      const params = {};
      if (search) params.search = search;
      if (status) params.status = status;
      const res = await apiClient.get('/root-admin/subscribers', { params });
      setSubscribers(res.data.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load subscribers');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(fetchSubscribers, 250);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, status]);

  useEffect(() => {
    apiClient.get('/root-admin/plan-creation').then((res) => setPlatformPlans(res.data.data)).catch(() => {});
  }, []);

  const openDetail = async (subscriber) => {
    setDetailLoading(true);
    setDetail({ subscriber });
    try {
      const res = await apiClient.get(`/root-admin/subscribers/${subscriber._id}`);
      setDetail(res.data.data);
      setPlanSelection(res.data.data.subscriber?.platformPlanId?._id || '');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load subscriber detail');
    } finally {
      setDetailLoading(false);
    }
  };

  const changePlan = async () => {
    if (!planSelection || !detail?.subscriber) return;
    setPlanSaving(true);
    try {
      await apiClient.patch(`/root-admin/subscribers/${detail.subscriber._id}/plan`, { platformPlanId: planSelection });
      await openDetail(detail.subscriber);
      await fetchSubscribers();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to change plan');
    } finally {
      setPlanSaving(false);
    }
  };

  const toggleActive = async (subscriber) => {
    try {
      const action = subscriber.isActive ? 'suspend' : 'activate';
      await apiClient.patch(`/root-admin/subscribers/${subscriber._id}/${action}`);
      await fetchSubscribers();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update subscriber');
    }
  };

  const impersonate = async (subscriber) => {
    try {
      const res = await apiClient.post(`/root-admin/subscribers/${subscriber._id}/impersonate`);
      const { token, user } = res.data.data;
      const url = `${window.location.origin}/impersonate?token=${encodeURIComponent(token)}&user=${encodeURIComponent(btoa(JSON.stringify(user)))}`;
      window.open(url, '_blank', 'noopener');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to impersonate');
    }
  };

  const doDelete = async () => {
    try {
      await apiClient.delete(`/root-admin/subscribers/${confirmDelete._id}`);
      setConfirmDelete(null);
      await fetchSubscribers();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to delete subscriber');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6 sm:p-8">
      <div className="mx-auto max-w-6xl">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Subscriber Management</h1>
          <p className="mt-1 text-gray-500">Every gym on the platform.</p>
        </div>

        {error && <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

        <div className="mt-6 flex flex-wrap gap-3">
          <label className="relative min-w-0 flex-1 sm:max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search gym name..." className="w-full rounded-xl border border-gray-200 bg-white py-2.5 pl-10 pr-4 text-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100" />
          </label>
          <select value={status} onChange={(e) => setStatus(e.target.value)} className="rounded-xl border border-gray-200 bg-white py-2.5 px-3.5 text-sm outline-none">
            <option value="">All statuses</option>
            <option value="active">Active</option>
            <option value="inactive">Suspended</option>
          </select>
        </div>

        <div className="mt-4 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
              <tr><th className="px-5 py-3">Gym</th><th className="px-5 py-3">Owner</th><th className="px-5 py-3">Plan</th><th className="px-5 py-3">Signed up</th><th className="px-5 py-3">Status</th><th className="px-5 py-3"></th></tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr><td colSpan={6} className="px-5 py-10 text-center text-gray-400">Loading...</td></tr>
              ) : subscribers.length === 0 ? (
                <tr><td colSpan={6} className="px-5 py-10 text-center text-gray-400"><Building2 className="mx-auto mb-2 h-6 w-6" />No subscribers found.</td></tr>
              ) : subscribers.map((s) => (
                <tr key={s._id} className={!s.isActive ? 'opacity-60' : ''}>
                  <td className="px-5 py-4"><button onClick={() => openDetail(s)} className="font-semibold text-gray-900 hover:text-teal-700">{s.gymName}</button></td>
                  <td className="px-5 py-4 text-gray-600">{s.owner?.name || '—'}</td>
                  <td className="px-5 py-4 capitalize text-gray-600">{s.plan}</td>
                  <td className="px-5 py-4 text-gray-600">{new Date(s.createdAt).toLocaleDateString()}</td>
                  <td className="px-5 py-4"><Badge tone={s.isActive ? 'green' : 'gray'}>{s.isActive ? 'Active' : 'Suspended'}</Badge></td>
                  <td className="px-5 py-4">
                    <div className="flex gap-1">
                      <button onClick={() => impersonate(s)} title="Impersonate" className="rounded-lg p-2 text-gray-500 hover:bg-gray-100"><LogIn className="h-4 w-4" /></button>
                      <button onClick={() => toggleActive(s)} title={s.isActive ? 'Suspend' : 'Activate'} className="rounded-lg p-2 text-gray-500 hover:bg-gray-100"><Power className="h-4 w-4" /></button>
                      <button onClick={() => setConfirmDelete(s)} title="Delete" className="rounded-lg p-2 text-red-500 hover:bg-red-50"><Trash2 className="h-4 w-4" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Modal open={!!detail} onClose={() => setDetail(null)} title={detail?.subscriber?.gymName || ''}>
        {detailLoading ? (
          <div className="flex justify-center py-8"><div className="h-6 w-6 animate-spin rounded-full border-b-2 border-teal-600" /></div>
        ) : detail?.stats ? (
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-xl bg-gray-50 p-3"><p className="text-gray-500">Members</p><p className="text-lg font-bold text-gray-900">{detail.stats.memberCount}</p></div>
              <div className="rounded-xl bg-gray-50 p-3"><p className="text-gray-500">Active members</p><p className="text-lg font-bold text-gray-900">{detail.stats.activeMemberCount}</p></div>
              <div className="rounded-xl bg-gray-50 p-3"><p className="text-gray-500">Staff</p><p className="text-lg font-bold text-gray-900">{detail.stats.staffCount}</p></div>
              <div className="rounded-xl bg-gray-50 p-3"><p className="text-gray-500">Total revenue</p><p className="text-lg font-bold text-gray-900">₹{detail.stats.totalRevenue.toLocaleString()}</p></div>
            </div>
            <div>
              <p className="mb-2 text-xs font-semibold uppercase text-gray-500">Owner</p>
              <p className="text-sm text-gray-700">{detail.owner?.name} — {detail.owner?.phone || detail.owner?.email}</p>
            </div>
            <div>
              <p className="mb-2 text-xs font-semibold uppercase text-gray-500">Platform plan</p>
              <p className="mb-2 text-sm text-gray-600">Current: <span className="font-medium text-gray-900">{detail.subscriber?.platformPlanId?.name || 'None assigned'}</span></p>
              <div className="flex gap-2">
                <select value={planSelection} onChange={(e) => setPlanSelection(e.target.value)} className="flex-1 rounded-xl border border-gray-200 bg-white py-2 px-3 text-sm outline-none focus:border-teal-500">
                  <option value="">Select a plan...</option>
                  {platformPlans.map((p) => (
                    <option key={p._id} value={p._id}>{p.name} — ₹{p.price}/mo</option>
                  ))}
                </select>
                <button
                  onClick={changePlan}
                  disabled={planSaving || !planSelection || planSelection === detail.subscriber?.platformPlanId?._id}
                  className="rounded-xl bg-teal-600 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-50"
                >
                  {planSaving ? 'Saving...' : 'Apply'}
                </button>
              </div>
            </div>
            <div>
              <p className="mb-2 text-xs font-semibold uppercase text-gray-500">Recent payments</p>
              {detail.recentPayments?.length ? (
                <div className="space-y-1.5">
                  {detail.recentPayments.map((p) => (
                    <div key={p._id} className="flex justify-between text-sm"><span className="text-gray-600">{p.memberId?.name || '—'}</span><span className="font-medium text-gray-900">₹{p.amountPaid.toLocaleString()}</span></div>
                  ))}
                </div>
              ) : <p className="text-sm text-gray-400">No payments yet.</p>}
            </div>
          </div>
        ) : null}
      </Modal>

      <Modal open={!!confirmDelete} onClose={() => setConfirmDelete(null)} title="Delete subscriber" footer={
        <>
          <button onClick={() => setConfirmDelete(null)} className="rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-600 hover:bg-gray-50">Cancel</button>
          <button onClick={doDelete} className="rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-700">Delete permanently</button>
        </>
      }>
        <p className="text-sm text-gray-600">This permanently deletes <b>{confirmDelete?.gymName}</b> and all its members, staff, payments, and history. This cannot be undone.</p>
      </Modal>
    </div>
  );
};

export default Subscribers;
