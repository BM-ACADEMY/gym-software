import { configureStore } from '@reduxjs/toolkit';
import authReducer from './slices/authSlice';

export const store = configureStore({
  reducer: {
    auth: authReducer,
    // api: apiSlice.reducer will go here later
  },
  // middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat(apiSlice.middleware),
});
