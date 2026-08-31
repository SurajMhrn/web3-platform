import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { NotificationBell } from './NotificationBell';
import { useAuth } from '../contexts/AuthContext';
import { apiClient } from '../services/apiClient';

vi.mock('../contexts/AuthContext', () => ({
  useAuth: vi.fn(),
}));

vi.mock('../services/apiClient', () => ({
  apiClient: { get: vi.fn(), patch: vi.fn() },
  getErrorMessage: (_err: unknown, fallback: string) => fallback,
}));

const mockUseAuth = vi.mocked(useAuth);

const NOTIFICATIONS = [
  { id: 'n1', type: 'token_created', title: 'Token Created', message: 'Your token is live', is_read: 0, created_at: new Date().toISOString() },
];

describe('NotificationBell', () => {
  beforeEach(() => {
    vi.mocked(apiClient.get).mockReset();
    vi.mocked(apiClient.patch).mockReset();
    mockUseAuth.mockReturnValue({ isAuthenticated: true } as unknown as ReturnType<typeof useAuth>);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders nothing when the user is not authenticated', () => {
    mockUseAuth.mockReturnValue({ isAuthenticated: false } as unknown as ReturnType<typeof useAuth>);
    const { container } = render(<MemoryRouter><NotificationBell /></MemoryRouter>);
    expect(container).toBeEmptyDOMElement();
  });

  it('fetches the unread count on mount and shows it as a badge', async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce({ data: { count: 3 } });

    render(<MemoryRouter><NotificationBell /></MemoryRouter>);

    expect(await screen.findByText('3')).toBeInTheDocument();
    expect(apiClient.get).toHaveBeenCalledWith('/notifications/unread-count');
  });

  it('polls the unread count again after 30 seconds', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.mocked(apiClient.get).mockResolvedValue({ data: { count: 1 } });

    render(<MemoryRouter><NotificationBell /></MemoryRouter>);
    await waitFor(() => expect(apiClient.get).toHaveBeenCalledTimes(1));

    await act(async () => {
      vi.advanceTimersByTime(30000);
    });

    await waitFor(() => expect(apiClient.get).toHaveBeenCalledTimes(2));
  });

  it('opens the popover, lists notifications, and marks one as read on click', async () => {
    vi.mocked(apiClient.get).mockImplementation((url: string) => {
      if (url.includes('unread-count')) return Promise.resolve({ data: { count: 1 } });
      return Promise.resolve({ data: { notifications: NOTIFICATIONS } });
    });
    vi.mocked(apiClient.patch).mockResolvedValueOnce({ data: {} });

    const user = userEvent.setup();
    render(<MemoryRouter><NotificationBell /></MemoryRouter>);

    await screen.findByText('1'); // initial unread badge

    await user.click(screen.getByRole('button'));
    expect(await screen.findByText('Token Created')).toBeInTheDocument();

    await user.click(screen.getByText('Token Created'));

    await waitFor(() => expect(apiClient.patch).toHaveBeenCalledWith('/notifications/n1/read'));
    // Badge disappears once unread count drops to 0.
    await waitFor(() => expect(screen.queryByText('1')).not.toBeInTheDocument());
  });
});
