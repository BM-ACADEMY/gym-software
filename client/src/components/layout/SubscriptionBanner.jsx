import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Clock } from 'lucide-react';
import { useSelector } from 'react-redux';
import apiClient from '../../api/client';
import { selectCurrentUser } from '../../store/slices/authSlice';

// Gym owner only: tells them how many trial days are left, or that payment is
// overdue / the plan has ended. The lock itself is enforced by the server.
const SubscriptionBanner = () => {
  const user = useSelector(selectCurrentUser);
  const [info, setInfo] = useState(null);

  useEffect(() => {
    if (user?.role !== 'admin') return;
    apiClient.get('/admin/subscription').then((r) => setInfo(r.data.data)).catch(() => {});
  }, [user?.role]);

  if (!info) return null;
  const { status, daysLeft } = info;
  const needsAttention = status === 'grace' || status === 'expired' || (status === 'trial' && daysLeft <= 5);
  if (!needsAttention) return null;

  const text = {
    trial: `Your free trial ends in ${daysLeft} day${daysLeft === 1 ? '' : 's'}. Choose a plan to keep everything running.`,
    grace: `Your plan has ended. Pay within ${daysLeft} day${daysLeft === 1 ? '' : 's'} to avoid read-only mode.`,
    expired: 'Your plan has ended. You can view your data, but changes are switched off until you pay.',
  }[status];
  const tone = status === 'expired' ? 'bg-red-600' : status === 'grace' ? 'bg-amber-500' : 'bg-teal-600';

  return (
    <div className={`flex flex-wrap items-center gap-2 px-4 py-2.5 text-sm font-medium text-white ${tone}`}>
      <Clock className="h-4 w-4 flex-shrink-0" />
      <span>{text}</span>
      <Link to="/admin/billing" className="ml-auto rounded-lg bg-white/20 px-3 py-1 font-semibold hover:bg-white/30">Choose plan</Link>
    </div>
  );
};

export default SubscriptionBanner;
