import { configureStore } from '@reduxjs/toolkit';
import authReducer from '../store/slices/authSlice';

// Builds an isolated store per test — never the real app singleton — so
// tests can set up whatever auth state (or none) they need without leaking
// into localStorage or other tests.
export const createTestStore = (authOverrides = {}) =>
  configureStore({
    reducer: { auth: authReducer },
    preloadedState: {
      auth: {
        user: null,
        token: null,
        isAuthenticated: false,
        suspended: false,
        ...authOverrides,
      },
    },
  });
