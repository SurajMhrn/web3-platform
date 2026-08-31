import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AdminDashboardPage } from './AdminDashboardPage';
import { useAuth } from '../contexts/AuthContext';
import { apiClient } from '../services/apiClient';

vi.mock('../contexts/AuthContext', () => ({
  useAuth: vi.fn(),
}));

vi.mock('../services/apiClient', () => ({
  apiClient: { get: vi.fn(), patch: vi.fn(), delete: vi.fn() },
  getErrorMessage: (_err: unknown, fallback: string) => fallback,
}));

const mockUseAuth = vi.mocked(useAuth);

const ADMIN_USER = { id: 'admin-1', email: 'admin@web3platform.com', role: 'admin' as const };

const STATS = {
  totalUsers: 3, totalAdmins: 1, totalModerators: 0, walletLinked: 1, regularUsers: 2,
};

const ANALYTICS = {
  days: 14,
  signups: [{ day: new Date().toISOString().slice(0, 10), count: 2 }],
  tokensCreated: [{ day: new Date().toISOString().slice(0, 10), count: 1 }],
  transactions: [{ day: new Date().toISOString().slice(0, 10), count: 3 }],
  topCreators: [{ user_id: 'u1', email: 'bob@example.com', username: 'bob', token_count: 4 }],
};

const USERS_PAGE = { users: [], total: 0, limit: 10, offset: 0 };

describe('AdminDashboardPage — analytics', () => {
  beforeEach(() => {
    mockUseAuth.mockReturnValue({ user: ADMIN_USER } as unknown as ReturnType<typeof useAuth>);
    vi.mocked(apiClient.get).mockReset();
    vi.mocked(apiClient.get).mockImplementation((url: string) => {
      if (url.startsWith('/admin/stats')) return Promise.resolve({ data: { stats: STATS } });
      if (url.startsWith('/admin/analytics')) return Promise.resolve({ data: ANALYTICS });
      if (url.startsWith('/admin/users')) return Promise.resolve({ data: USERS_PAGE });
      if (url.startsWith('/notifications')) return Promise.resolve({ data: { count: 0, notifications: [] } });
      return Promise.reject(new Error(`unexpected GET ${url}`));
    });
  });

  it('fetches and renders the three analytics charts and the top-creators list', async () => {
    render(<MemoryRouter><AdminDashboardPage /></MemoryRouter>);

    await waitFor(() => expect(apiClient.get).toHaveBeenCalledWith('/admin/analytics?days=14'));

    expect(await screen.findByText('Analytics — Last 14 Days')).toBeInTheDocument();
    expect(screen.getByText('New Signups')).toBeInTheDocument();
    expect(screen.getByText('Tokens Created')).toBeInTheDocument();
    expect(screen.getByText('Transactions')).toBeInTheDocument();

    // MiniBarChart renders one <img>-role svg per series.
    expect(screen.getAllByRole('img')).toHaveLength(3);

    expect(screen.getByText(/bob/)).toBeInTheDocument();
    expect(screen.getByText('4')).toBeInTheDocument();
  });

  it('shows an empty-state message when there are no top creators yet', async () => {
    vi.mocked(apiClient.get).mockImplementation((url: string) => {
      if (url.startsWith('/admin/stats')) return Promise.resolve({ data: { stats: STATS } });
      if (url.startsWith('/admin/analytics')) return Promise.resolve({ data: { ...ANALYTICS, topCreators: [] } });
      if (url.startsWith('/admin/users')) return Promise.resolve({ data: USERS_PAGE });
      if (url.startsWith('/notifications')) return Promise.resolve({ data: { count: 0, notifications: [] } });
      return Promise.reject(new Error(`unexpected GET ${url}`));
    });

    render(<MemoryRouter><AdminDashboardPage /></MemoryRouter>);

    expect(await screen.findByText('No tokens created yet.')).toBeInTheDocument();
  });

  it('shows a toast-worthy fallback and no crash if the analytics request fails', async () => {
    vi.mocked(apiClient.get).mockImplementation((url: string) => {
      if (url.startsWith('/admin/stats')) return Promise.resolve({ data: { stats: STATS } });
      if (url.startsWith('/admin/analytics')) return Promise.reject(new Error('server error'));
      if (url.startsWith('/admin/users')) return Promise.resolve({ data: USERS_PAGE });
      if (url.startsWith('/notifications')) return Promise.resolve({ data: { count: 0, notifications: [] } });
      return Promise.reject(new Error(`unexpected GET ${url}`));
    });

    render(<MemoryRouter><AdminDashboardPage /></MemoryRouter>);

    // Stats still load fine even though analytics failed.
    expect(await screen.findByText('Total Users')).toBeInTheDocument();
    expect(screen.queryByText('New Signups')).not.toBeInTheDocument();
  });
});
