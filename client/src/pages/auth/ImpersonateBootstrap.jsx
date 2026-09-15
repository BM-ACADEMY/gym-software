import { useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { setCredentials } from '../../store/slices/authSlice';

// Landing point for a Root Admin's "Impersonate" action, opened in a new tab
// so the Root Admin's own session in the original tab is never touched.
const ImpersonateBootstrap = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [error, setError] = useState('');

  useEffect(() => {
    try {
      const token = searchParams.get('token');
      const userParam = searchParams.get('user');
      if (!token || !userParam) throw new Error('Missing impersonation credentials');
      const user = JSON.parse(atob(userParam));
      dispatch(setCredentials({ token, user }));
      navigate('/admin', { replace: true });
    } catch {
      setError('This impersonation link is invalid or has expired.');
    }
  }, [searchParams, dispatch, navigate]);

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 p-6">
        <p className="text-sm text-red-600">{error}</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-teal-600" />
    </div>
  );
};

export default ImpersonateBootstrap;
