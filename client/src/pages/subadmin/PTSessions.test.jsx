import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { MemoryRouter } from 'react-router-dom';
import PTSessions from './PTSessions';
import apiClient from '../../api/client';
import { createTestStore } from '../../test/testStore';

vi.mock('../../api/client', () => ({
  default: { get: vi.fn(), put: vi.fn(), post: vi.fn(), patch: vi.fn() },
}));

const SESSION = {
  _id: 's1',
  scheduledAt: '2026-09-20T10:00:00.000Z',
  status: 'scheduled',
  memberId: { _id: 'm1', name: 'Rohit Sharma' },
};

const mockGetResponses = () => {
  apiClient.get.mockImplementation((url) => {
    if (url === '/subadmin/pt-sessions') return Promise.resolve({ data: { data: [SESSION] } });
    if (url === '/subadmin/members') return Promise.resolve({ data: { data: { members: [{ _id: 'm1', name: 'Rohit Sharma' }] } } });
    if (url === '/subadmin/pt-sessions/packages') return Promise.resolve({ data: { data: [] } });
    return Promise.resolve({ data: { data: [] } });
  });
};

const renderPage = () =>
  render(
    <Provider
      store={createTestStore({
        isAuthenticated: true,
        user: { id: 'trainer1', name: 'Coach Rao', role: 'subadmin', permissions: { 'pt-sessions': { view: true, edit: true } } },
      })}
    >
      <MemoryRouter>
        <PTSessions />
      </MemoryRouter>
    </Provider>
  );

describe('Trainer PT Sessions — reschedule', () => {
  it('reschedules a session through the modal, calling the reschedule endpoint', async () => {
    mockGetResponses();
    apiClient.put.mockResolvedValueOnce({ data: { success: true } });
    const user = userEvent.setup();

    renderPage();

    expect(await screen.findByText('Rohit Sharma')).toBeInTheDocument();

    await user.click(screen.getByTitle('Reschedule'));
    expect(await screen.findByText('Reschedule session')).toBeInTheDocument();

    await user.click(screen.getByText('Save new time'));

    await waitFor(() => expect(apiClient.put).toHaveBeenCalledTimes(1));
    const [url, body] = apiClient.put.mock.calls[0];
    expect(url).toBe('/subadmin/pt-sessions/s1/reschedule');
    expect(body).toHaveProperty('scheduledAt');

    await waitFor(() => expect(screen.queryByText('Reschedule session')).not.toBeInTheDocument());
  });
});
