import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CheckCircle2, ShieldCheck } from 'lucide-react';
import apiClient from '../../api/client';
import PasswordInput from '../../components/ui/PasswordInput';

const THEMES = {
  tenant: {
    wrapper: 'bg-gradient-to-br from-gray-950 via-teal-950 to-gray-900',
    glow: 'bg-teal-600/10',
    cardBg: 'bg-white',
    cardBorder: 'border-gray-100',
    label: 'text-gray-700',
    input: 'appearance-none block w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm bg-gray-50 focus:bg-white transition-all',
    iconClass: 'text-gray-400 hover:text-gray-600',
    accentText: 'text-teal-400',
    button: 'bg-[linear-gradient(135deg,rgb(45,212,191),rgb(13,148,136))] hover:brightness-110 shadow-teal-500/30',
    errorBox: 'bg-red-50 border border-red-100 text-red-600',
    title: 'text-white',
    subtitle: 'text-gray-300',
    footerText: 'text-gray-400',
    footerLink: 'text-teal-400 hover:text-teal-300',
    loginPath: '/login',
    requestUrl: '/auth/reset-password-request',
    verifyUrl: '/auth/reset-password-verify',
    identifierLabel: 'Phone or Email',
    identifierPlaceholder: 'Enter your phone or email',
  },
  root: {
    wrapper: 'bg-gray-950',
    glow: 'bg-teal-900/10',
    cardBg: 'bg-gray-900',
    cardBorder: 'border-gray-800',
    label: 'text-gray-300',
    input: 'appearance-none block w-full px-4 py-3 border border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-600 focus:border-transparent text-sm bg-gray-800 text-white placeholder-gray-500 transition-all',
    iconClass: 'text-gray-500 hover:text-gray-300',
    accentText: 'text-teal-500',
    button: 'bg-[linear-gradient(135deg,rgb(45,212,191),rgb(13,148,136))] hover:brightness-110',
    errorBox: 'bg-red-950/50 border border-red-900 text-red-400',
    title: 'text-white',
    subtitle: 'text-gray-400',
    footerText: 'text-gray-500',
    footerLink: 'text-teal-500 hover:text-teal-400',
    loginPath: '/root-admin-login',
    requestUrl: '/auth/reset-root-password-request',
    verifyUrl: '/auth/reset-root-password-verify',
    identifierLabel: 'Phone or Email',
    identifierPlaceholder: 'Enter your phone or email',
  },
};

const ForgotPassword = ({ variant = 'tenant' }) => {
  const t = THEMES[variant];
  const [searchParams] = useSearchParams();

  const [step, setStep] = useState(1); // 1: request OTP, 2: verify + set new password, 3: done
  const [identifier, setIdentifier] = useState(searchParams.get('id') || '');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleRequest = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const response = await apiClient.post(t.requestUrl, { identifier });
      if (response.data.success) {
        setStep(2);
        if (response.data.demoOtp) {
          alert(`[DEMO MODE] Your OTP is: ${response.data.demoOtp}`);
        }
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to send OTP.');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async (e) => {
    e.preventDefault();
    setError('');

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    setLoading(true);
    try {
      const response = await apiClient.post(t.verifyUrl, { identifier, otp, newPassword });
      if (response.data.success) {
        setStep(3);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to reset password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`min-h-screen ${t.wrapper} flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative overflow-hidden`}>
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] ${t.glow} rounded-full blur-3xl`}></div>
      </div>

      <div className="sm:mx-auto sm:w-full sm:max-w-md relative z-10 text-center mb-6">
        <Link to="/" className="inline-flex items-center gap-2 mb-6">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${variant === 'root' ? 'bg-gray-800 border border-gray-700' : 'bg-gradient-to-br from-teal-600 to-teal-700 shadow-lg shadow-teal-500/30'}`}>
            {variant === 'root' ? (
              <ShieldCheck className={`w-6 h-6 ${t.accentText}`} />
            ) : (
              <svg viewBox="0 0 24 24" fill="white" className="w-6 h-6">
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
              </svg>
            )}
          </div>
          <span className={`text-3xl font-extrabold tracking-tight ${t.title}`}>Gym<span className={t.accentText}>Desk</span></span>
        </Link>
        <h2 className={`text-2xl font-bold mb-1 ${t.title}`}>Reset your password</h2>
        <p className={`text-sm ${t.subtitle}`}>
          {step === 1 && "We'll send a one-time code to verify it's you"}
          {step === 2 && 'Enter the code and choose a new password'}
          {step === 3 && "You're all set"}
        </p>
      </div>

      <div className="sm:mx-auto sm:w-full sm:max-w-md relative z-10">
        <div className={`${t.cardBg} py-8 px-6 shadow-2xl rounded-3xl sm:px-10 border ${t.cardBorder}`}>
          {step === 1 && (
            <form className="space-y-5" onSubmit={handleRequest}>
              {error && <div className={`px-4 py-3 rounded-xl text-sm font-medium ${t.errorBox}`}>{error}</div>}
              <div>
                <label className={`block text-sm font-medium mb-1 ${t.label}`}>{t.identifierLabel}</label>
                <input
                  required
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder={t.identifierPlaceholder}
                  className={t.input}
                />
              </div>
              <div className="pt-2">
                <button type="submit" disabled={loading} className={`w-full flex justify-center py-3.5 px-4 border border-transparent rounded-xl shadow-lg text-sm font-bold text-white transition-all ${t.button} ${loading ? 'opacity-75 cursor-not-allowed' : ''}`}>
                  {loading ? 'Sending code...' : 'Send reset code'}
                </button>
              </div>
            </form>
          )}

          {step === 2 && (
            <form className="space-y-5" onSubmit={handleReset}>
              {error && <div className={`px-4 py-3 rounded-xl text-sm font-medium ${t.errorBox}`}>{error}</div>}
              <div>
                <label className={`block text-sm font-medium mb-1 ${t.label}`}>Verification Code</label>
                <input
                  required
                  type="text"
                  maxLength={6}
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  placeholder="------"
                  className={`${t.input} tracking-[0.5em] text-center text-xl font-bold`}
                />
              </div>
              <div>
                <label className={`block text-sm font-medium mb-1 ${t.label}`}>New Password</label>
                <PasswordInput required value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="At least 6 characters" className={t.input} iconClassName={t.iconClass} />
              </div>
              <div>
                <label className={`block text-sm font-medium mb-1 ${t.label}`}>Confirm New Password</label>
                <PasswordInput required value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Re-enter new password" className={t.input} iconClassName={t.iconClass} />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setStep(1)} className={`flex-[0.4] py-3.5 rounded-xl text-sm font-bold border ${variant === 'root' ? 'border-gray-700 text-gray-300 hover:bg-gray-800' : 'border-gray-200 text-gray-600 hover:bg-gray-50'} transition-colors`}>
                  Back
                </button>
                <button type="submit" disabled={loading} className={`flex-1 flex justify-center py-3.5 px-4 border border-transparent rounded-xl shadow-lg text-sm font-bold text-white transition-all ${t.button} ${loading ? 'opacity-75 cursor-not-allowed' : ''}`}>
                  {loading ? 'Resetting...' : 'Reset Password'}
                </button>
              </div>
            </form>
          )}

          {step === 3 && (
            <div className="text-center py-4">
              <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${variant === 'root' ? 'bg-teal-950/50' : 'bg-teal-100'}`}>
                <CheckCircle2 className={`w-8 h-8 ${t.accentText}`} />
              </div>
              <h3 className={`text-lg font-bold mb-2 ${variant === 'root' ? 'text-white' : 'text-gray-900'}`}>Password reset</h3>
              <p className={`text-sm mb-6 ${variant === 'root' ? 'text-gray-400' : 'text-gray-500'}`}>
                Your password has been updated. You can sign in with your new password now.
              </p>
              <Link
                to={t.loginPath}
                className={`inline-flex w-full justify-center py-3.5 px-4 rounded-xl shadow-lg text-sm font-bold text-white transition-all ${t.button}`}
              >
                Back to Sign In
              </Link>
            </div>
          )}
        </div>

        {step !== 3 && (
          <p className={`mt-6 text-center text-sm ${t.footerText}`}>
            Remembered your password?{' '}
            <Link to={t.loginPath} className={`font-medium transition-colors ${t.footerLink}`}>
              Sign in
            </Link>
          </p>
        )}
      </div>
    </div>
  );
};

export default ForgotPassword;
