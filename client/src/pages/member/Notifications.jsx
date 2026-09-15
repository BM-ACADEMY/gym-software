import { useEffect, useState } from 'react';
import { Bell, Check } from 'lucide-react';
import { Card, Page, PageHeader, Pill } from '../subadmin/ui';
import apiClient from '../../api/client';
import useSuspended from '../../hooks/useSuspended';

const CHANNEL_TONE = { in_app: 'gray', sms: 'blue', email: 'violet', push: 'green' };

const Notifications = () => {
  const suspended = useSuspended();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      const res = await apiClient.get('/member/notifications');
      setNotifications(res.data.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load notifications');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchNotifications(); }, []);

  const markRead = async (n) => {
    try {
      await apiClient.patch(`/member/notifications/${n._id}/read`);
      await fetchNotifications();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to mark read');
    }
  };

  return (
    <Page>
      <PageHeader eyebrow="Customer workspace" title="Notifications" description="Plan reminders, PT session alerts, and gym announcements." />
      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      <Card className="overflow-hidden">
        <div className="divide-y divide-gray-100">
          {loading ? (
            <p className="p-5 text-sm text-gray-400">Loading...</p>
          ) : notifications.length === 0 ? (
            <div className="flex flex-col items-center gap-3 px-6 py-16 text-gray-400"><Bell className="h-6 w-6" /><p className="text-sm">No notifications yet.</p></div>
          ) : notifications.map((n) => (
            <div key={n._id} className={`flex items-start gap-3 p-4 ${!n.readAt ? 'bg-teal-50/40' : ''}`}>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-gray-900 capitalize">{n.type.replace(/_/g, ' ')}</p>
                  <Pill tone={CHANNEL_TONE[n.channel] || 'gray'}>{n.channel}</Pill>
                </div>
                <p className="mt-1 text-sm text-gray-600">{n.message}</p>
                <p className="mt-1 text-xs text-gray-400">{new Date(n.createdAt).toLocaleString()}</p>
              </div>
              {!n.readAt && (
                <button onClick={() => markRead(n)} disabled={suspended} title="Mark read" className="rounded-lg p-2 text-gray-400 hover:bg-emerald-50 hover:text-emerald-600 disabled:cursor-not-allowed disabled:opacity-40"><Check className="h-4 w-4" /></button>
              )}
            </div>
          ))}
        </div>
      </Card>
    </Page>
  );
};

export default Notifications;
