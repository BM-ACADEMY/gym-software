import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import Dashboard from './Dashboard';
import apiClient from '../../api/client';
import { createTestStore } from '../../test/testStore';

vi.mock('../../api/client', () => ({
  default: { get: vi.fn() },
}));

const DASHBOARD_RESPONSE = {
  data: {
    data: {
      planStatus: { status: 'active', planName: 'Gold Monthly', expiresAt: '2026-12-01', daysRemaining: 12 },
      nextSession: { scheduledAt: '2026-09-20T10:00:00.000Z', subAdminId: { name: 'Coach Rao' } },
      nextPayment: { _id: 'pay1', dueDate: '2026-09-25T00:00:00.000Z', balanceDue: 1500, effectiveStatus: 'pending' },
      streak: 4,
      qrCode: 'data:image/png;base64,fake',
    },
  },
};

const renderDashboard = () =>
  render(
    <Provider store={createTestStore({ isAuthenticated: true, user: { id: 'm1', name: 'Asha Rao', role: 'member' } })}>
      <MemoryRouter initialEntries={['/member']}>
        <Routes>
          <Route path="/member" element={<Dashboard />} />
          <Route path="/member/payments" element={<div>Payments page</div>} />
        </Routes>
      </MemoryRouter>
    </Provider>
  );

describe('Member Dashboard', () => {
  it('shows the next payment due and lets the member jump to Payments', async () => {
    apiClient.get.mockResolvedValueOnce(DASHBOARD_RESPONSE);
    const user = userEvent.setup();

    renderDashboard();

    expect(await screen.findByText('₹1,500')).toBeInTheDocument();
    expect(screen.getByText(/Due/)).toBeInTheDocument();
    expect(screen.getByText(/Coach Rao/)).toBeInTheDocument();

    await user.click(screen.getByText('Pay now →'));
    await waitFor(() => expect(screen.getByText('Payments page')).toBeInTheDocument());
  });

  it('shows a caught-up message when there is no pending payment', async () => {
    apiClient.get.mockResolvedValueOnce({
      data: { data: { ...DASHBOARD_RESPONSE.data.data, nextPayment: null } },
    });

    renderDashboard();

    expect(await screen.findByText(/you're all caught up/i)).toBeInTheDocument();
  });
});
