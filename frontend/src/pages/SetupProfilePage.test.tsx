import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { SetupProfilePage } from './SetupProfilePage';
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

const authedUser = { id: '1', email: 'a@b.com', role: 'user' as const };

describe('SetupProfilePage', () => {
  beforeEach(() => {
    mockNavigate.mockReset();
    vi.mocked(apiClient.post).mockReset();
    mockUseAuth.mockReturnValue({
      isAuthenticated: true,
      user: authedUser,
      setUser: vi.fn(),
    } as unknown as ReturnType<typeof useAuth>);
  });

  it('redirects to /login when not authenticated', () => {
    mockUseAuth.mockReturnValue({
      isAuthenticated: false,
      user: null,
      setUser: vi.fn(),
    } as unknown as ReturnType<typeof useAuth>);

    render(<MemoryRouter><SetupProfilePage /></MemoryRouter>);

    expect(mockNavigate).toHaveBeenCalledWith('/login');
  });

  it('rejects a username shorter than 3 characters', async () => {
    const user = userEvent.setup();
    render(<MemoryRouter><SetupProfilePage /></MemoryRouter>);

    await user.type(screen.getByPlaceholderText('CoolUser99'), 'ab');
    await user.click(screen.getByRole('button', { name: /save profile/i }));

    expect(await screen.findByText('Username must be at least 3 characters')).toBeInTheDocument();
    expect(apiClient.post).not.toHaveBeenCalled();
  });

  it('rejects a profile picture that is a non-empty, non-URL string', async () => {
    const user = userEvent.setup();
    render(<MemoryRouter><SetupProfilePage /></MemoryRouter>);

    await user.type(screen.getByPlaceholderText('CoolUser99'), 'validname');
    await user.type(screen.getByPlaceholderText('https://example.com/pic.png'), 'not-a-url');
    await user.click(screen.getByRole('button', { name: /save profile/i }));

    expect(await screen.findByText('Must be a valid URL')).toBeInTheDocument();
    expect(apiClient.post).not.toHaveBeenCalled();
  });

  it('accepts an empty profile picture and submits successfully', async () => {
    const setUser = vi.fn();
    mockUseAuth.mockReturnValue({
      isAuthenticated: true,
      user: authedUser,
      setUser,
    } as unknown as ReturnType<typeof useAuth>);
    vi.mocked(apiClient.post).mockResolvedValueOnce({
      data: { user: { ...authedUser, username: 'validname' } },
    });

    const user = userEvent.setup();
    render(<MemoryRouter><SetupProfilePage /></MemoryRouter>);

    await user.type(screen.getByPlaceholderText('CoolUser99'), 'validname');
    await user.click(screen.getByRole('button', { name: /save profile/i }));

    await waitFor(() => expect(apiClient.post).toHaveBeenCalledWith('/auth/setup-profile', expect.objectContaining({
      username: 'validname',
      profilePicture: '',
    })));
    expect(setUser).toHaveBeenCalled();
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/dashboard'));
  });
});
