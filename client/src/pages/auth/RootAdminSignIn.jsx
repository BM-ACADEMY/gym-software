import { useState } from 'react';
import { useDispatch } from 'react-redux';
import { useNavigate, Link } from 'react-router-dom';
import { ShieldCheck } from 'lucide-react';
import { setCredentials } from '../../store/slices/authSlice';
import apiClient from '../../api/client';
import PasswordInput from '../../components/ui/PasswordInput';

// Deliberately separate from the shared SignIn page — Root Admin (platform
// staff) never shares a login form with tenant-side accounts (Gym Owner,
// Sub-Admin, Member).
const RootAdminSignIn = () => {
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const dispatch = useDispatch();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await apiClient.post('/auth/login-root', { phone, password });
      if (response.data.success) {
        const { data, token } = response.data;
        dispatch(setCredentials({ user: data, token }));
        navigate('/root-admin');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to login.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative overflow-hidden">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-teal-900/10 rounded-full blur-3xl"></div>
      </div>

      <div className="sm:mx-auto sm:w-full sm:max-w-md relative z-10 text-center mb-6">
        <Link to="/" className="inline-flex items-center gap-2 mb-6">
          <div className="w-10 h-10 rounded-xl bg-gray-800 border border-gray-700 flex items-center justify-center">
            <ShieldCheck className="w-6 h-6 text-teal-500" />
          </div>
          <span className="text-3xl font-extrabold text-white tracking-tight">Gym<span className="text-teal-500">Desk</span></span>
        </Link>
        <h2 className="text-2xl font-bold text-white mb-1">Root Admin Console</h2>
        <p className="text-sm text-gray-400">Platform team access only</p>
      </div>

      <div className="sm:mx-auto sm:w-full sm:max-w-md relative z-10">
        <div className="bg-gray-900 py-8 px-6 shadow-2xl rounded-3xl sm:px-10 border border-gray-800">
          <form className="space-y-5" onSubmit={handleSubmit}>
            {error && (
              <div className="bg-red-950/50 border border-red-900 text-red-400 px-4 py-3 rounded-xl text-sm font-medium">
                {error}
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Phone Number</label>
              <input
                required
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Enter phone number"
                className="appearance-none block w-full px-4 py-3 border border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-600 focus:border-transparent text-sm bg-gray-800 text-white placeholder-gray-500 transition-all"
              />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-sm font-medium text-gray-300">Password</label>
                <Link to={`/root-admin-forgot-password${phone ? `?id=${encodeURIComponent(phone)}` : ''}`} className="text-xs font-medium text-teal-500 hover:text-teal-400">
                  Forgot password?
                </Link>
              </div>
              <PasswordInput
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                className="appearance-none block w-full px-4 py-3 border border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-600 focus:border-transparent text-sm bg-gray-800 text-white placeholder-gray-500 transition-all"
                iconClassName="text-gray-500 hover:text-gray-300"
              />
            </div>
            <div className="pt-2">
              <button
                type="submit"
                disabled={loading}
                className={`w-full flex justify-center py-3.5 px-4 border border-transparent rounded-xl text-sm font-bold text-white bg-[linear-gradient(135deg,rgb(45,212,191),rgb(13,148,136))] hover:brightness-110 transition-all ${loading ? 'opacity-75 cursor-not-allowed' : ''}`}
              >
                {loading ? 'Signing in...' : 'Sign in'}
              </button>
            </div>
          </form>

          <p className="mt-6 text-center text-sm text-gray-500">
            Not platform staff?{' '}
            <Link to="/login" className="font-medium text-teal-500 hover:text-teal-400 transition-colors">
              Go to the regular sign in
            </Link>
          </p>
          <p className="mt-2 text-center text-sm text-gray-500">
            New to the platform team?{' '}
            <Link to="/root-admin-request-access" className="font-medium text-teal-500 hover:text-teal-400 transition-colors">
              Request access
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default RootAdminSignIn;
