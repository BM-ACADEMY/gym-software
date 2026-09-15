import { createSlice } from '@reduxjs/toolkit';

const STORAGE_KEY = 'gymdesk_auth';

// Persisted so a page refresh doesn't lose the session — Redux state alone
// resets to nothing on every reload since it only lives in memory. Guarded
// because localStorage can throw (private browsing, disabled storage).
const loadPersisted = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.token || !parsed?.user) return null;
    return parsed;
  } catch {
    return null;
  }
};

const persisted = loadPersisted();

const initialState = {
  user: persisted?.user || null, // { id, name, role, subscriberId, permissions?, template?, etc }
  token: persisted?.token || null,
  isAuthenticated: Boolean(persisted),
  // Whether the logged-in user's gym is currently suspended by Root Admin —
  // not persisted (always re-derived from the API's X-Gym-Suspended header
  // on the next request, see api/client.js), so it can never go stale.
  suspended: false,
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setCredentials: (state, action) => {
      const { user, token } = action.payload;
      state.user = user;
      state.token = token;
      state.isAuthenticated = true;
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ user, token }));
      } catch {
        // Storage unavailable — session just won't survive a refresh this time.
      }
    },
    logout: (state) => {
      state.user = null;
      state.token = null;
      state.isAuthenticated = false;
      state.suspended = false;
      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch {
        // Nothing to clean up if storage was never usable.
      }
    },
    setSuspended: (state, action) => {
      state.suspended = action.payload;
    },
  },
});

export const { setCredentials, logout, setSuspended } = authSlice.actions;

export const selectCurrentUser = (state) => state.auth.user;
export const selectIsAuthenticated = (state) => state.auth.isAuthenticated;
export const selectToken = (state) => state.auth.token;
export const selectSuspended = (state) => state.auth.suspended;
// Sub-Admin's { module: { view, edit } } map — undefined for every other role.
export const selectPermissions = (state) => state.auth.user?.permissions;

export default authSlice.reducer;
