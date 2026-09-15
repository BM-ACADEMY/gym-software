import { useEffect, useState } from 'react';
import { Megaphone, RefreshCw, Send } from 'lucide-react';
import apiClient from '../../api/client';
import Badge from '../../components/ui/Badge';
import useSuspended from '../../hooks/useSuspended';

const CHANNEL_TONE = { in_app: 'gray', sms: 'blue', email: 'violet', push: 'green' };
const RECIPIENT_OPTIONS = [['members', 'All members'], ['staff', 'All staff'], ['all', 'Everyone']];

const NotificationsCenter = () => {
  const suspended = useSuspended();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [message, setMessage] = useState('');
  const [recipientType, setRecipientType] = useState('members');
  const [sending, setSending] = useState(false);
  const [runningRules, setRunningRules] = useState(false);

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      const res = await apiClient.get('/admin/notifications');
      setNotifications(res.data.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load notifications');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchNotifications(); }, []);

  const sendBroadcast = async (e) => {
    e.preventDefault();
    if (!message.trim()) return;
    setSending(true);
    setError(''); setSuccess('');
    try {
      const res = await apiClient.post('/admin/notifications/broadcast', { message, recipientType });
      setSuccess(res.data.message);
      setMessage('');
      await fetchNotifications();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to send broadcast');
    } finally {
      setSending(false);
    }
  };

  const runRules = async () => {
    setRunningRules(true);
    setError(''); setSuccess('');
    try {
      const res = await apiClient.post('/admin/notifications/run-rules');
      const { expiry, overdue, pt } = res.data.data;
      setSuccess(`Rules run: ${expiry} expiry, ${overdue} overdue, ${pt} PT reminders sent.`);
      await fetchNotifications();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to run rules');
    } finally {
      setRunningRules(false);
    }
  };

  return (
    <div className="p-6 sm:p-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Notifications Center</h1>
          <p className="mt-1 text-gray-500">Broadcast announcements and review the auto-notification log.</p>
        </div>
        <button onClick={runRules} disabled={runningRules || suspended} className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50">
          <RefreshCw className={`h-4 w-4 ${runningRules ? 'animate-spin' : ''}`} /> Run rules now
        </button>
      </div>

      {error && <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
      {success && <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{success}</div>}

      <form onSubmit={sendBroadcast} className="mt-6 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <h3 className="mb-3 flex items-center gap-2 font-semibold text-gray-900"><Megaphone className="h-4 w-4" /> Broadcast announcement</h3>
        <textarea required value={message} onChange={(e) => setMessage(e.target.value)} rows={3} placeholder="e.g. Gym closed tomorrow for maintenance" className="w-full rounded-lg border border-gray-200 px-3.5 py-2.5 text-sm" />
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <select value={recipientType} onChange={(e) => setRecipientType(e.target.value)} className="rounded-lg border border-gray-200 px-3.5 py-2.5 text-sm">
            {RECIPIENT_OPTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          <button type="submit" disabled={sending || suspended} className="inline-flex items-center gap-2 rounded-xl bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-50">
            <Send className="h-4 w-4" /> {sending ? 'Sending...' : 'Send'}
          </button>
        </div>
      </form>

      <div className="mt-6 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-100 px-5 py-4"><h3 className="font-semibold text-gray-900">Notification log</h3></div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
              <tr><th className="px-5 py-3">When</th><th className="px-5 py-3">To</th><th className="px-5 py-3">Channel</th><th className="px-5 py-3">Type</th><th className="px-5 py-3">Message</th></tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr><td colSpan={5} className="px-5 py-8 text-center text-gray-400">Loading...</td></tr>
              ) : notifications.length === 0 ? (
                <tr><td colSpan={5} className="px-5 py-8 text-center text-gray-400">No notifications sent yet.</td></tr>
              ) : notifications.map((n) => (
                <tr key={n._id}>
                  <td className="px-5 py-3 text-gray-600">{new Date(n.createdAt).toLocaleString()}</td>
                  <td className="px-5 py-3 capitalize text-gray-600">{n.recipientType}</td>
                  <td className="px-5 py-3"><Badge tone={CHANNEL_TONE[n.channel] || 'gray'}>{n.channel}</Badge></td>
                  <td className="px-5 py-3 text-gray-600">{n.type.replace(/_/g, ' ')}</td>
                  <td className="max-w-md truncate px-5 py-3 text-gray-500">{n.message}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default NotificationsCenter;
