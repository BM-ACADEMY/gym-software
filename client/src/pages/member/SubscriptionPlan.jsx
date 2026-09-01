import { useEffect, useState } from 'react';
import { Snowflake, RefreshCw, Sparkles } from 'lucide-react';
import apiClient from '../../api/client';
import Modal from '../../components/ui/Modal';
import Badge from '../../components/ui/Badge';

const STATUS_TONE = {
  active: 'green',
  trial: 'blue',
  expiring: 'amber',
  expired: 'red',
  frozen: 'violet',
  cancelled: 'gray',
};

const daysRemaining = (expiresAt) => {
  if (!expiresAt) return null;
  const diff = Math.ceil((new Date(expiresAt) - new Date()) / (1000 * 60 * 60 * 24));
  return diff;
};

const SubscriptionPlan = () => {
  const [subscription, setSubscription] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [toast, setToast] = useState(null);
  const [freezeOpen, setFreezeOpen] = useState(false);
  const [freezeDays, setFreezeDays] = useState('');
  const [freezeReason, setFreezeReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const fetchSubscription = async () => {
    try {
      setLoading(true);
      const res = await apiClient.get('/member/subscription-plan');
      setSubscription(res.data.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load your subscription');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSubscription();
  }, []);

  const handleRenew = async (planId) => {
    setActionLoading(true);
    try {
      const res = await apiClient.post('/member/subscription-plan/renew', { planId });
      showToast(res.data.message);
      await fetchSubscription();
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to renew', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleFreeze = async (e) => {
    e.preventDefault();
    setActionLoading(true);
    try {
      const res = await apiClient.post('/member/subscription-plan/freeze', {
        days: Number(freezeDays),
        reason: freezeReason,
      });
      showToast(res.data.message);
      setFreezeOpen(false);
      setFreezeDays('');
      setFreezeReason('');
      await fetchSubscription();
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to freeze plan', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleUnfreeze = async () => {
    setActionLoading(true);
    try {
      const res = await apiClient.post('/member/subscription-plan/unfreeze');
      showToast(res.data.message);
      await fetchSubscription();
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to unfreeze plan', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 sm:p-8">
        <div className="px-4 py-3 rounded-lg text-sm font-medium bg-red-50 text-red-700 border border-red-200">{error}</div>
      </div>
    );
  }

  const { status, expiresAt, plan, availablePlans } = subscription;
  const remaining = daysRemaining(expiresAt);

  return (
    <div className="p-6 sm:p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Subscription Plan</h1>
        <p className="mt-1.5 text-gray-500">Your current plan, renewal, and freeze options.</p>
      </div>

      {toast && (
        <div className={`mb-6 px-4 py-3 rounded-lg text-sm font-medium ${toast.type === 'error' ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-green-50 text-green-700 border border-green-200'}`}>
          {toast.msg}
        </div>
      )}

      {/* Current plan card */}
      <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm max-w-2xl">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm text-gray-400">Current Plan</p>
            <h2 className="text-2xl font-bold text-gray-900 mt-0.5">{plan?.name || 'No active plan'}</h2>
          </div>
          <Badge tone={STATUS_TONE[status] || 'gray'}>{status}</Badge>
        </div>

        {plan ? (
          <>
            <div className="mt-5 grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-gray-400">Renewal Date</p>
                <p className="font-semibold text-gray-800 mt-0.5">{expiresAt ? new Date(expiresAt).toDateString() : '—'}</p>
              </div>
              <div>
                <p className="text-gray-400">Days Remaining</p>
                <p className={`font-semibold mt-0.5 ${remaining !== null && remaining <= 3 ? 'text-red-600' : 'text-gray-800'}`}>
                  {remaining !== null ? Math.max(remaining, 0) : '—'}
                </p>
              </div>
            </div>

            {plan.includedServices?.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-1.5">
                {plan.includedServices.map((s, i) => (
                  <Badge key={i} tone="violet">{s}</Badge>
                ))}
              </div>
            )}

            <div className="mt-6 flex flex-wrap gap-3">
              <button
                onClick={() => handleRenew(plan._id)}
                disabled={actionLoading}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[linear-gradient(135deg,rgb(45,212,191),rgb(13,148,136))] text-white text-sm font-semibold hover:brightness-110 disabled:opacity-60"
              >
                <RefreshCw className="h-4 w-4" />
                Renew
              </button>
              {plan.allowFreeze && status !== 'frozen' && (
                <button
                  onClick={() => setFreezeOpen(true)}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50"
                >
                  <Snowflake className="h-4 w-4" />
                  Request Freeze
                </button>
              )}
              {status === 'frozen' && (
                <button
                  onClick={handleUnfreeze}
                  disabled={actionLoading}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-60"
                >
                  Unfreeze
                </button>
              )}
            </div>
          </>
        ) : (
          <p className="mt-3 text-sm text-gray-500">
            You don't have an active plan yet. Pick one below to get started.
          </p>
        )}
      </div>

      {/* Available plans to upgrade / start */}
      {availablePlans?.length > 0 && (
        <div className="mt-8">
          <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">
            {plan ? 'Switch Plan' : 'Choose a Plan'}
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 max-w-4xl">
            {availablePlans.map((p) => (
              <div key={p._id} className="rounded-2xl border border-gray-200 bg-white p-5 flex flex-col">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-gray-900">{p.name}</h4>
                  {p.trialEligible && <Badge tone="blue">Trial</Badge>}
                </div>
                <p className="mt-2 text-2xl font-extrabold text-gray-900">
                  ₹{p.price}
                  <span className="text-xs font-medium text-gray-400"> / {p.durationDays}d</span>
                </p>
                <button
                  onClick={() => handleRenew(p._id)}
                  disabled={actionLoading || plan?._id === p._id}
                  className="mt-4 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-gray-900 text-white text-xs font-semibold hover:bg-gray-800 disabled:opacity-40"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  {plan?._id === p._id ? 'Current Plan' : plan ? 'Switch to this plan' : 'Start this plan'}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <Modal
        open={freezeOpen}
        onClose={() => setFreezeOpen(false)}
        title="Request a Freeze"
        footer={
          <>
            <button onClick={() => setFreezeOpen(false)} className="px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50">
              Cancel
            </button>
            <button
              type="submit"
              form="freeze-form"
              disabled={actionLoading}
              className="px-4 py-2.5 rounded-xl bg-[linear-gradient(135deg,rgb(45,212,191),rgb(13,148,136))] text-white text-sm font-semibold hover:brightness-110 disabled:opacity-60"
            >
              {actionLoading ? 'Submitting...' : 'Freeze Plan'}
            </button>
          </>
        }
      >
        <form id="freeze-form" onSubmit={handleFreeze} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Days to freeze {plan ? `(max ${plan.maxFreezeDays})` : ''}
            </label>
            <input required type="number" min="1" max={plan?.maxFreezeDays} value={freezeDays} onChange={(e) => setFreezeDays(e.target.value)} className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Reason (optional)</label>
            <textarea rows={2} value={freezeReason} onChange={(e) => setFreezeReason(e.target.value)} placeholder="Medical leave, travel, etc." className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" />
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default SubscriptionPlan;
