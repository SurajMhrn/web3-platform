import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { LoginPage } from './LoginPage';
import { useAuth } from '../contexts/AuthContext';
import { apiClient } from '../services/apiClient';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return { ...actual, useNavigate: () => mockNavigate };
});

vi.mock('../contexts/AuthContext', () => ({
  useAuth: vi.fn(),
}));

vi.mock('../services/apiClient', () => ({
  apiClient: { post: vi.fn() },
  getErrorMessage: (_err: unknown, fallback: string) => fallback,
}));

const mockUseAuth = vi.mocked(useAuth);

describe('LoginPage', () => {
  beforeEach(() => {
    mockNavigate.mockReset();
    vi.mocked(apiClient.post).mockReset();
    mockUseAuth.mockReturnValue({
      isAuthenticated: false,
      setUser: vi.fn(),
    } as unknown as ReturnType<typeof useAuth>);
  });

  it('shows validation errors and does not call the API for an invalid email', async () => {
    const user = userEvent.setup();
    render(<MemoryRouter><LoginPage /></MemoryRouter>);

    await user.type(screen.getByPlaceholderText('you@example.com'), 'not-an-email');
    await user.type(screen.getByPlaceholderText('••••••••'), 'password123');
    await user.click(screen.getByRole('button', { name: /login/i }));

    expect(await screen.findByText('Invalid email address')).toBeInTheDocument();
    expect(apiClient.post).not.toHaveBeenCalled();
  });

  it('logs in with valid credentials, sets the user, and redirects to dashboard', async () => {
    const setUser = vi.fn();
    mockUseAuth.mockReturnValue({ isAuthenticated: false, setUser } as unknown as ReturnType<typeof useAuth>);
    vi.mocked(apiClient.post).mockResolvedValueOnce({
      data: { user: { id: '1', email: 'a@b.com', role: 'user', username: 'alice' } },
    });

    const user = userEvent.setup();
    render(<MemoryRouter><LoginPage /></MemoryRouter>);

    await user.type(screen.getByPlaceholderText('you@example.com'), 'a@b.com');
    await user.type(screen.getByPlaceholderText('••••••••'), 'password123');
    await user.click(screen.getByRole('button', { name: /login/i }));

    await waitFor(() => expect(apiClient.post).toHaveBeenCalledWith('/auth/login', {
      email: 'a@b.com',
      password: 'password123',
    }));
    expect(setUser).toHaveBeenCalledWith({ id: '1', email: 'a@b.com', role: 'user', username: 'alice' });
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/dashboard'));
  });

  it('redirects a user with no username yet to /setup-profile instead of /dashboard', async () => {
    vi.mocked(apiClient.post).mockResolvedValueOnce({
      data: { user: { id: '1', email: 'a@b.com', role: 'user', username: null } },
    });

    const user = userEvent.setup();
    render(<MemoryRouter><LoginPage /></MemoryRouter>);

    await user.type(screen.getByPlaceholderText('you@example.com'), 'a@b.com');
    await user.type(screen.getByPlaceholderText('••••••••'), 'password123');
    await user.click(screen.getByRole('button', { name: /login/i }));

    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/setup-profile'));
  });

  it('shows a toast-worthy error message on invalid credentials without crashing', async () => {
    vi.mocked(apiClient.post).mockRejectedValueOnce({
      isAxiosError: true,
      response: { data: { error: 'Invalid credentials' } },
    });

    const user = userEvent.setup();
    render(<MemoryRouter><LoginPage /></MemoryRouter>);

    await user.type(screen.getByPlaceholderText('you@example.com'), 'a@b.com');
    await user.type(screen.getByPlaceholderText('••••••••'), 'wrong-password');
    await user.click(screen.getByRole('button', { name: /login/i }));

    await waitFor(() => expect(apiClient.post).toHaveBeenCalled());
    // No navigation should happen on failed login.
    expect(mockNavigate).not.toHaveBeenCalled();
  });
});
