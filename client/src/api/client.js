import axios from 'axios';
import { store } from '../store/store';
import { logout, setSuspended } from '../store/slices/authSlice';

// Every response for an admin/subadmin/member request carries this header
// (see server/middleware/auth.js) — read it off both success and error
// responses so the suspended banner reflects the true, current state, not
// just whatever happened to be true at login.
const syncSuspendedFlag = (headers) => {
  if (!headers) return;
  const value = headers['x-gym-suspended'];
  if (value === undefined) return;
  const suspended = value === 'true';
  if (store.getState().auth.suspended !== suspended) {
    store.dispatch(setSuspended(suspended));
  }
};

const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add a request interceptor to attach the JWT token
apiClient.interceptors.request.use(
  (config) => {
    // Token lives in the Redux store, which rehydrates from localStorage on
    // load (see authSlice.js) — this stays the single source of truth.
    const token = store.getState().auth.token;
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// A rejected/expired token (e.g. a persisted session whose JWT has since
// expired, or a short-lived impersonation token) must not leave the app
// stuck "logged in" but unable to load anything — clear it and send them to login.
apiClient.interceptors.response.use(
  (response) => {
    syncSuspendedFlag(response.headers);
    return response;
  },
  (error) => {
    syncSuspendedFlag(error.response?.headers);
    const authState = store.getState().auth;
    if (error.response?.status === 401 && authState.isAuthenticated) {
      const isRootAdmin = authState.user?.role === 'root_admin';
      store.dispatch(logout());
      window.location.href = isRootAdmin ? '/root-admin-login' : '/login';
    }
    return Promise.reject(error);
  }
);

export default apiClient;
