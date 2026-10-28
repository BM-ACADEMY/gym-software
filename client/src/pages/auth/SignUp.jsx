import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { setCredentials } from '../../store/slices/authSlice';
import apiClient from '../../api/client';
import PasswordInput from '../../components/ui/PasswordInput';
import { INDIAN_STATES } from '../../utils/indianStates';
import { useT } from '../../i18n';

const SignUp = () => {
  const { t } = useT();
  const [formData, setFormData] = useState({ gymName: '', ownerName: '', email: '', phone: '', state: 'Tamil Nadu', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();
  const dispatch = useDispatch();

  const handleSignup = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const response = await apiClient.post('/auth/signup', formData);
      if (response.data.success) {
        const { data, token } = response.data;
        dispatch(setCredentials({ user: data, token }));
        navigate('/admin');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Could not create your account. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-teal-950 to-gray-900 flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-teal-600/10 rounded-full blur-3xl"></div>
        <div className="absolute inset-0" style={{backgroundImage:'radial-gradient(rgba(13,148,136,0.1) 1px, transparent 1px)', backgroundSize:'40px 40px'}}></div>
      </div>

      <div className="sm:mx-auto sm:w-full sm:max-w-md relative z-10 text-center mb-6">
        <Link to="/" className="inline-flex items-center gap-2 mb-6">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-teal-600 to-teal-700 flex items-center justify-center shadow-lg shadow-teal-500/30">
            <svg viewBox="0 0 24 24" fill="white" className="w-6 h-6">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
            </svg>
          </div>
          <span className="text-3xl font-extrabold text-white tracking-tight">Gym<span className="text-teal-400">Desk</span></span>
        </Link>
        <h2 className="text-3xl font-bold text-white mb-2">{t('Start your 14-day free trial')}</h2>
        <p className="text-sm text-gray-300">
          {t('Already have an account?')}{' '}
          <Link to="/login" className="font-medium text-teal-400 hover:text-teal-300 transition-colors">
            {t('Sign in')}
          </Link>
        </p>
      </div>

      <div className="sm:mx-auto sm:w-full sm:max-w-md relative z-10">
        <div className="bg-white py-8 px-6 shadow-2xl rounded-3xl sm:px-10 border border-gray-100">
          
          <form className="space-y-5" onSubmit={handleSignup}>
            {error && (
              <div className="bg-red-50 border border-red-100 text-red-600 px-4 py-3 rounded-xl text-sm font-medium">{error}</div>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('Gym Name')}</label>
                <input required type="text" value={formData.gymName} onChange={(e) => setFormData({ ...formData, gymName: e.target.value })} className="appearance-none block w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm bg-gray-50 focus:bg-white transition-all" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('Your Name')}</label>
                <input required type="text" value={formData.ownerName} onChange={(e) => setFormData({ ...formData, ownerName: e.target.value })} className="appearance-none block w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm bg-gray-50 focus:bg-white transition-all" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('Email address')}</label>
              <input required type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} className="appearance-none block w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm bg-gray-50 focus:bg-white transition-all" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('Mobile number')}</label>
              <input required type="tel" value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} placeholder="e.g. 9876543210" className="appearance-none block w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm bg-gray-50 focus:bg-white transition-all" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('State')}</label>
              <select required value={formData.state} onChange={(e) => setFormData({ ...formData, state: e.target.value })} className="appearance-none block w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm bg-gray-50 focus:bg-white transition-all">
                {INDIAN_STATES.map((st) => <option key={st} value={st}>{st}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('Password (8 or more characters)')}</label>
              <PasswordInput required minLength={8} value={formData.password} onChange={(e) => setFormData({ ...formData, password: e.target.value })} className="appearance-none block w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm bg-gray-50 focus:bg-white transition-all" />
            </div>
            <button type="submit" disabled={loading} className={`w-full flex justify-center py-3.5 px-4 border border-transparent rounded-xl shadow-lg shadow-teal-500/30 text-sm font-bold text-white bg-[linear-gradient(135deg,rgb(45,212,191),rgb(13,148,136))] hover:brightness-110 transition-all ${loading ? 'opacity-75 cursor-not-allowed' : 'hover:-translate-y-0.5'}`}>
              {loading ? t('Creating your gym...') : t('Start 14-day free trial')}
            </button>
            <p className="text-xs text-center text-gray-500">{t('No card needed. By continuing you agree to our')} <Link to="/terms" className="underline">{t('Terms')}</Link> {t('and')} <Link to="/privacy" className="underline">{t('Privacy Policy')}</Link>.</p>
          </form>
        </div>
      </div>
    </div>
  );
};

export default SignUp;
