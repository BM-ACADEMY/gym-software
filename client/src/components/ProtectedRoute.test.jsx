import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Provider } from 'react-redux';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import ProtectedRoute from './ProtectedRoute';
import { createTestStore } from '../test/testStore';

const renderProtected = ({ authState, allowedRoles }) =>
  render(
    <Provider store={createTestStore(authState)}>
      <MemoryRouter initialEntries={['/admin/dashboard']}>
        <Routes>
          <Route
            path="/admin/dashboard"
            element={
              <ProtectedRoute allowedRoles={allowedRoles}>
                <div>Secret admin content</div>
              </ProtectedRoute>
            }
          />
          <Route path="/login" element={<div>Login page</div>} />
          <Route path="/member" element={<div>Member dashboard</div>} />
        </Routes>
      </MemoryRouter>
    </Provider>
  );

describe('ProtectedRoute', () => {
  it('redirects an unauthenticated visitor to /login', () => {
    renderProtected({ authState: { isAuthenticated: false, user: null }, allowedRoles: ['admin'] });
    expect(screen.getByText('Login page')).toBeInTheDocument();
    expect(screen.queryByText('Secret admin content')).not.toBeInTheDocument();
  });

  it('redirects an authenticated user with the wrong role to their own dashboard', () => {
    renderProtected({
      authState: { isAuthenticated: true, user: { role: 'member' } },
      allowedRoles: ['admin'],
    });
    expect(screen.getByText('Member dashboard')).toBeInTheDocument();
    expect(screen.queryByText('Secret admin content')).not.toBeInTheDocument();
  });

  it('renders the protected content for a user with an allowed role', () => {
    renderProtected({
      authState: { isAuthenticated: true, user: { role: 'admin' } },
      allowedRoles: ['admin'],
    });
    expect(screen.getByText('Secret admin content')).toBeInTheDocument();
  });
});
