import { useState } from 'react';
import { useDispatch } from 'react-redux';
import { useNavigate, Link } from 'react-router-dom';
import { setCredentials } from '../../store/slices/authSlice';
import apiClient from '../../api/client';
import { ROLE_BASE_PATH } from '../../config/navigation';
import PasswordInput from '../../components/ui/PasswordInput';

const PASSWORD_INPUT_CLASS = 'appearance-none block w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm bg-gray-50 focus:bg-white transition-all';

const SignIn = () => {
  const [activeTab, setActiveTab] = useState('email'); // 'email' or 'phone'
  const [phoneMode, setPhoneMode] = useState('password'); // 'password' or 'otp'
  const [step, setStep] = useState(1); // 1: Info form, 2: OTP verify (phone+OTP mode only)

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');

  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const dispatch = useDispatch();
  const navigate = useNavigate();

  // For Email/Password
  const handleEmailLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await apiClient.post('/auth/login-email', { email, password });
      if (response.data.success) {
        const { data, token } = response.data;
        dispatch(setCredentials({ user: data, token }));
        navigateRole(data.role);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to login.');
    } finally {
      setLoading(false);
    }
  };

  // For Phone + Password (Gym Owner, Sub-Admin, Member share this)
  const handlePhonePasswordLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await apiClient.post('/auth/login-phone', { phone, password });
      if (response.data.success) {
        const { data, token } = response.data;
        dispatch(setCredentials({ user: data, token }));
        navigateRole(data.role);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to login.');
    } finally {
      setLoading(false);
    }
  };

  // For Phone OTP Request
  const handlePhoneRequest = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await apiClient.post('/auth/request-otp', { phone });
      if (response.data.success) {
        setStep(2);
        if (response.data.demoOtp) {
          alert(`[DEMO MODE] Your OTP is: ${response.data.demoOtp}`);
        }
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to request OTP.');
    } finally {
      setLoading(false);
    }
  };

  // For Phone OTP Verify
  const handlePhoneVerify = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await apiClient.post('/auth/login-otp', { phone, otp });
      if (response.data.success) {
        const { data, token } = response.data;
        dispatch(setCredentials({ user: data, token }));
        navigateRole(data.role);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Invalid or expired OTP.');
    } finally {
      setLoading(false);
    }
  };

  const navigateRole = (role) => {
    const base = ROLE_BASE_PATH[role];
    if (base) navigate(base);
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
        <h2 className="text-3xl font-bold text-white mb-2">Welcome back</h2>
        <p className="text-sm text-gray-300">
          Or{' '}
          <Link to="/register" className="font-medium text-teal-400 hover:text-teal-300 transition-colors">
            start your 7-day free trial
          </Link>
        </p>
      </div>

      <div className="sm:mx-auto sm:w-full sm:max-w-md relative z-10">
        <div className="bg-white py-8 px-6 shadow-2xl rounded-3xl sm:px-10 border border-gray-100">
          
          {step === 1 && (
            <>
              {/* Tabs */}
              <div className="flex p-1 bg-gray-100 rounded-xl mb-8">
                <button
                  className={`flex-1 py-2.5 text-sm font-semibold rounded-lg transition-all duration-200 ${activeTab === 'email' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                  onClick={() => { setActiveTab('email'); setError(''); }}
                >
                  Email
                </button>
                <button
                  className={`flex-1 py-2.5 text-sm font-semibold rounded-lg transition-all duration-200 ${activeTab === 'phone' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                  onClick={() => { setActiveTab('phone'); setError(''); }}
                >
                  Phone
                </button>
              </div>

              {activeTab === 'email' ? (
                <form className="space-y-5" onSubmit={handleEmailLogin}>
                  {error && (
                    <div className="bg-red-50 border border-red-100 text-red-600 px-4 py-3 rounded-xl text-sm font-medium">
                      {error}
                    </div>
                  )}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Email address</label>
                    <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="appearance-none block w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm bg-gray-50 focus:bg-white transition-all" placeholder="Enter your email" />
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-sm font-medium text-gray-700">Password</label>
                      <Link to={`/forgot-password${email ? `?id=${encodeURIComponent(email)}` : ''}`} className="text-xs font-medium text-teal-600 hover:text-teal-700">
                        Forgot password?
                      </Link>
                    </div>
                    <PasswordInput required value={password} onChange={(e) => setPassword(e.target.value)} className={PASSWORD_INPUT_CLASS} placeholder="Enter your password" />
                  </div>
                  <div className="pt-2">
                    <button type="submit" disabled={loading} className={`w-full flex justify-center py-3.5 px-4 border border-transparent rounded-xl shadow-lg shadow-teal-500/30 text-sm font-bold text-white bg-[linear-gradient(135deg,rgb(45,212,191),rgb(13,148,136))] hover:brightness-110 transition-all ${loading ? 'opacity-75 cursor-not-allowed' : 'hover:-translate-y-0.5'}`}>
                      {loading ? 'Signing in...' : 'Sign in'}
                    </button>
                  </div>
                </form>
              ) : (
                <>
                  {/* Password vs OTP sub-toggle */}
                  <div className="flex gap-4 mb-5 text-sm font-medium">
                    <button
                      type="button"
                      className={phoneMode === 'password' ? 'text-teal-600' : 'text-gray-400 hover:text-gray-600'}
                      onClick={() => { setPhoneMode('password'); setError(''); }}
                    >
                      Sign in with Password
                    </button>
                    <span className="text-gray-300">|</span>
                    <button
                      type="button"
                      className={phoneMode === 'otp' ? 'text-teal-600' : 'text-gray-400 hover:text-gray-600'}
                      onClick={() => { setPhoneMode('otp'); setError(''); }}
                    >
                      Sign in with OTP
                    </button>
                  </div>

                  {phoneMode === 'password' ? (
                    <form className="space-y-5" onSubmit={handlePhonePasswordLogin}>
                      {error && (
                        <div className="bg-red-50 border border-red-100 text-red-600 px-4 py-3 rounded-xl text-sm font-medium">
                          {error}
                        </div>
                      )}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
                        <input required type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Enter phone number" className="appearance-none block w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm bg-gray-50 focus:bg-white transition-all" />
                      </div>
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="block text-sm font-medium text-gray-700">Password</label>
                          <Link to={`/forgot-password${phone ? `?id=${encodeURIComponent(phone)}` : ''}`} className="text-xs font-medium text-teal-600 hover:text-teal-700">
                            Forgot password?
                          </Link>
                        </div>
                        <PasswordInput required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Enter your password" className={PASSWORD_INPUT_CLASS} />
                      </div>
                      <div className="pt-2">
                        <button type="submit" disabled={loading} className={`w-full flex justify-center py-3.5 px-4 border border-transparent rounded-xl shadow-lg shadow-teal-500/30 text-sm font-bold text-white bg-[linear-gradient(135deg,rgb(45,212,191),rgb(13,148,136))] hover:brightness-110 transition-all ${loading ? 'opacity-75 cursor-not-allowed' : 'hover:-translate-y-0.5'}`}>
                          {loading ? 'Signing in...' : 'Sign in'}
                        </button>
                      </div>
                    </form>
                  ) : (
                    <form className="space-y-5" onSubmit={handlePhoneRequest}>
                      {error && (
                        <div className="bg-red-50 border border-red-100 text-red-600 px-4 py-3 rounded-xl text-sm font-medium">
                          {error}
                        </div>
                      )}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number (with Country Code)</label>
                        <input required type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="e.g. 919876543210" className="appearance-none block w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm bg-gray-50 focus:bg-white transition-all" />
                      </div>
                      <div className="pt-2">
                        <button type="submit" disabled={loading} className={`w-full flex justify-center py-3.5 px-4 border border-transparent rounded-xl shadow-lg shadow-teal-500/30 text-sm font-bold text-white bg-[linear-gradient(135deg,rgb(45,212,191),rgb(13,148,136))] hover:brightness-110 transition-all ${loading ? 'opacity-75 cursor-not-allowed' : 'hover:-translate-y-0.5'}`}>
                          {loading ? 'Sending OTP...' : 'Send OTP'}
                        </button>
                      </div>
                    </form>
                  )}
                </>
              )}
            </>
          )}

          {step === 2 && (
            <form className="space-y-6" onSubmit={handlePhoneVerify}>
              <div className="text-center mb-6">
                <div className="w-16 h-16 bg-teal-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-3xl">🔐</span>
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">Verify it's you</h3>
                <p className="text-sm text-gray-500">
                  We sent a 6-digit code to <span className="font-semibold text-gray-700">{phone}</span>
                </p>
              </div>

              {error && (
                <div className="bg-red-50 border border-red-100 text-red-600 px-4 py-3 rounded-xl text-sm font-medium mb-4">
                  {error}
                </div>
              )}
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Verification Code</label>
                <input required type="text" maxLength={6} value={otp} onChange={(e) => setOtp(e.target.value)} className="appearance-none block w-full px-4 py-3 border border-gray-200 rounded-xl tracking-[0.5em] text-center text-xl font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent bg-gray-50 focus:bg-white transition-all" placeholder="------" />
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setStep(1)} className="flex-[0.4] py-3.5 border border-gray-200 rounded-xl text-sm font-bold text-gray-600 hover:bg-gray-50 transition-colors">Back</button>
                <button type="submit" disabled={loading} className={`flex-1 flex justify-center py-3.5 px-4 border border-transparent rounded-xl shadow-lg shadow-teal-500/30 text-sm font-bold text-white bg-[linear-gradient(135deg,rgb(45,212,191),rgb(13,148,136))] hover:brightness-110 transition-all ${loading ? 'opacity-75 cursor-not-allowed' : 'hover:-translate-y-0.5'}`}>
                  {loading ? 'Verifying...' : 'Verify & Sign in'}
                </button>
              </div>
            </form>
          )}

        </div>

        <p className="mt-6 text-center text-sm text-gray-400">
          Platform team?{' '}
          <Link to="/root-admin-login" className="font-medium text-teal-400 hover:text-teal-300 transition-colors">
            Sign in to the Root Admin console
          </Link>
        </p>
      </div>
    </div>
  );
};

export default SignIn;
