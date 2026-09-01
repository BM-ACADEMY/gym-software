import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { setCredentials } from '../../store/slices/authSlice';
import apiClient from '../../api/client';
import PasswordInput from '../../components/ui/PasswordInput';

const SignUp = () => {
  const [activeTab, setActiveTab] = useState('email'); // 'email' or 'phone'
  const [step, setStep] = useState(1); // 1: Info form, 2: OTP verify
  const [formData, setFormData] = useState({
    gymName: '',
    ownerName: '',
    email: '',
    password: '',
    phone: ''
  });
  const [otp, setOtp] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  
  const navigate = useNavigate();
  const dispatch = useDispatch();

  const handleRequestOtp = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await apiClient.post('/auth/register-otp-request', {
        type: activeTab,
        identifier: activeTab === 'email' ? formData.email : formData.phone,
        gymName: formData.gymName,
        ownerName: formData.ownerName,
        password: activeTab === 'email' ? formData.password : undefined
      });

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

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await apiClient.post('/auth/register-otp-verify', {
        identifier: activeTab === 'email' ? formData.email : formData.phone,
        otp
      });

      if (response.data.success) {
        const { data, token } = response.data;
        dispatch(setCredentials({ user: data, token }));
        navigate('/admin/dashboard');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Invalid or expired OTP.');
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
        <h2 className="text-3xl font-bold text-white mb-2">Create an account</h2>
        <p className="text-sm text-gray-300">
          Already have an account?{' '}
          <Link to="/login" className="font-medium text-teal-400 hover:text-teal-300 transition-colors">
            Sign in
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
                  Phone OTP
                </button>
              </div>

              <form className="space-y-5" onSubmit={handleRequestOtp}>
                {error && (
                  <div className="bg-red-50 border border-red-100 text-red-600 px-4 py-3 rounded-xl text-sm font-medium">
                    {error}
                  </div>
                )}
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Gym Name</label>
                    <input required type="text" value={formData.gymName} onChange={(e) => setFormData({...formData, gymName: e.target.value})} className="appearance-none block w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm bg-gray-50 focus:bg-white transition-all" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Your Name</label>
                    <input required type="text" value={formData.ownerName} onChange={(e) => setFormData({...formData, ownerName: e.target.value})} className="appearance-none block w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm bg-gray-50 focus:bg-white transition-all" />
                  </div>
                </div>
                
                {activeTab === 'email' ? (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Email address</label>
                      <input required type="email" value={formData.email} onChange={(e) => setFormData({...formData, email: e.target.value})} className="appearance-none block w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm bg-gray-50 focus:bg-white transition-all" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                      <PasswordInput required value={formData.password} onChange={(e) => setFormData({...formData, password: e.target.value})} className="appearance-none block w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm bg-gray-50 focus:bg-white transition-all" />
                    </div>
                  </>
                ) : (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number (with Country Code)</label>
                    <input required type="tel" value={formData.phone} onChange={(e) => setFormData({...formData, phone: e.target.value})} placeholder="e.g. 919876543210" className="appearance-none block w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm bg-gray-50 focus:bg-white transition-all" />
                  </div>
                )}

                <div className="pt-2">
                  <button type="submit" disabled={loading} className={`w-full flex justify-center py-3.5 px-4 border border-transparent rounded-xl shadow-lg shadow-teal-500/30 text-sm font-bold text-white bg-[linear-gradient(135deg,rgb(45,212,191),rgb(13,148,136))] hover:brightness-110 transition-all ${loading ? 'opacity-75 cursor-not-allowed' : 'hover:-translate-y-0.5'}`}>
                    {loading ? 'Sending OTP...' : 'Continue'}
                  </button>
                </div>
              </form>
            </>
          )}

          {step === 2 && (
            <form className="space-y-6" onSubmit={handleVerifyOtp}>
              <div className="text-center mb-6">
                <div className="w-16 h-16 bg-teal-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-3xl">🔐</span>
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">Verify it's you</h3>
                <p className="text-sm text-gray-500">
                  We sent a 6-digit code to <span className="font-semibold text-gray-700">{activeTab === 'email' ? formData.email : formData.phone}</span>
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
                  {loading ? 'Verifying...' : 'Create Account'}
                </button>
              </div>
            </form>
          )}

        </div>
      </div>
    </div>
  );
};

export default SignUp;
