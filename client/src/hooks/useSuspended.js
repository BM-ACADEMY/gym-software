import { useSelector } from 'react-redux';
import { selectSuspended } from '../store/slices/authSlice';

// True once the logged-in user's gym has been suspended by Root Admin — the
// server already rejects every write in this state (middleware/auth.js),
// this is what pages use to stop offering those actions in the first place
// instead of letting someone fill out a form that can only ever fail.
const useSuspended = () => useSelector(selectSuspended);

export default useSuspended;
