import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ShieldCheck } from 'lucide-react';
import apiClient from '../../api/client';
import PasswordInput from '../../components/ui/PasswordInput';

const RootAdminRequestAccess = () => {
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '' });
  const [error, setError] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await apiClient.post('/auth/request-root-access', form);
      setSubmitted(true);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to submit request.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen flex-col justify-center overflow-hidden bg-gray-950 py-12 sm:px-6 lg:px-8">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute left-1/2 top-1/2 h-[800px] w-[800px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-teal-900/10 blur-3xl"></div>
      </div>

      <div className="relative z-10 mb-6 text-center sm:mx-auto sm:w-full sm:max-w-md">
        <Link to="/" className="mb-6 inline-flex items-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-gray-700 bg-gray-800">
            <ShieldCheck className="h-6 w-6 text-teal-500" />
          </div>
          <span className="text-3xl font-extrabold tracking-tight text-white">Gym<span className="text-teal-500">Desk</span></span>
        </Link>
        <h2 className="mb-1 text-2xl font-bold text-white">Request Root Admin access</h2>
        <p className="text-sm text-gray-400">For GymDesk platform team members only</p>
      </div>

      <div className="relative z-10 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="rounded-3xl border border-gray-800 bg-gray-900 px-6 py-8 shadow-2xl sm:px-10">
          {submitted ? (
            <p className="text-center text-sm text-gray-300">Your request has been submitted. An existing Root Admin will review and approve it — you'll be able to sign in once approved.</p>
          ) : (
            <form className="space-y-5" onSubmit={handleSubmit}>
              {error && <div className="rounded-xl border border-red-900 bg-red-950/50 px-4 py-3 text-sm font-medium text-red-400">{error}</div>}
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-300">Full name</label>
                <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="block w-full rounded-xl border border-gray-700 bg-gray-800 px-4 py-3 text-sm text-white placeholder-gray-500 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-teal-600" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-300">Email</label>
                <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="block w-full rounded-xl border border-gray-700 bg-gray-800 px-4 py-3 text-sm text-white placeholder-gray-500 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-teal-600" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-300">Phone</label>
                <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="block w-full rounded-xl border border-gray-700 bg-gray-800 px-4 py-3 text-sm text-white placeholder-gray-500 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-teal-600" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-300">Password</label>
                <PasswordInput required value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className="block w-full rounded-xl border border-gray-700 bg-gray-800 px-4 py-3 text-sm text-white placeholder-gray-500 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-teal-600" iconClassName="text-gray-500 hover:text-gray-300" />
              </div>
              <button type="submit" disabled={loading} className={`w-full rounded-xl bg-[linear-gradient(135deg,rgb(45,212,191),rgb(13,148,136))] py-3.5 text-sm font-bold text-white hover:brightness-110 ${loading ? 'cursor-not-allowed opacity-75' : ''}`}>
                {loading ? 'Submitting...' : 'Submit request'}
              </button>
            </form>
          )}
          <p className="mt-6 text-center text-sm text-gray-500">
            <Link to="/root-admin-login" className="font-medium text-teal-500 hover:text-teal-400">Back to sign in</Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default RootAdminRequestAccess;
