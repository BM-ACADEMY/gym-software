import { useSelector } from 'react-redux';
import { ShieldAlert } from 'lucide-react';
import { selectSuspended, selectCurrentUser } from '../../store/slices/authSlice';

// Shown across every page (Owner, Staff, Member) once the gym has been
// suspended by Root Admin — the actual write-block is enforced server-side
// (middleware/auth.js), this just makes the read-only state visible up front
// instead of surprising someone only when their first save fails. Only the
// Gym Owner has a support-ticket form (Settings), so only they get pointed
// at it — that's the one write the backend still allows while suspended.
const SuspendedBanner = () => {
  const suspended = useSelector(selectSuspended);
  const user = useSelector(selectCurrentUser);
  if (!suspended) return null;

  return (
    <div className="flex items-center gap-2 bg-red-600 px-4 py-2.5 text-sm font-medium text-white">
      <ShieldAlert className="h-4 w-4 flex-shrink-0" />
      <span>
        This gym's account is suspended. You can view existing data, but adding, editing, or deleting anything is disabled until it's reactivated.
        {user?.role === 'admin' && ' Need it restored? Submit a request from Settings → Contact support.'}
      </span>
    </div>
  );
};

export default SuspendedBanner;
