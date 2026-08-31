import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { RegisterPage } from './RegisterPage';
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

describe('RegisterPage', () => {
  beforeEach(() => {
    mockNavigate.mockReset();
    vi.mocked(apiClient.post).mockReset();
    mockUseAuth.mockReturnValue({ setUser: vi.fn() } as unknown as ReturnType<typeof useAuth>);
  });

  it('rejects a password shorter than 8 characters', async () => {
    const user = userEvent.setup();
    render(<MemoryRouter><RegisterPage /></MemoryRouter>);

    await user.type(screen.getByPlaceholderText('you@example.com'), 'a@b.com');
    const [password, confirm] = screen.getAllByPlaceholderText('••••••••');
    await user.type(password, 'short1');
    await user.type(confirm, 'short1');
    await user.click(screen.getByRole('button', { name: /register/i }));

    expect(await screen.findByText('Password must be at least 8 characters')).toBeInTheDocument();
    expect(apiClient.post).not.toHaveBeenCalled();
  });

  it("rejects mismatched confirm-password", async () => {
    const user = userEvent.setup();
    render(<MemoryRouter><RegisterPage /></MemoryRouter>);

    await user.type(screen.getByPlaceholderText('you@example.com'), 'a@b.com');
    const [password, confirm] = screen.getAllByPlaceholderText('••••••••');
    await user.type(password, 'password123');
    await user.type(confirm, 'password124');
    await user.click(screen.getByRole('button', { name: /register/i }));

    expect(await screen.findByText("Passwords don't match")).toBeInTheDocument();
    expect(apiClient.post).not.toHaveBeenCalled();
  });

  it('registers with matching valid passwords and redirects to setup-profile', async () => {
    const setUser = vi.fn();
    mockUseAuth.mockReturnValue({ setUser } as unknown as ReturnType<typeof useAuth>);
    vi.mocked(apiClient.post).mockResolvedValueOnce({
      data: { user: { id: '1', email: 'a@b.com', role: 'user' } },
    });

    const user = userEvent.setup();
    render(<MemoryRouter><RegisterPage /></MemoryRouter>);

    await user.type(screen.getByPlaceholderText('you@example.com'), 'a@b.com');
    const [password, confirm] = screen.getAllByPlaceholderText('••••••••');
    await user.type(password, 'password123');
    await user.type(confirm, 'password123');
    await user.click(screen.getByRole('button', { name: /register/i }));

    await waitFor(() => expect(apiClient.post).toHaveBeenCalledWith('/auth/register', {
      email: 'a@b.com',
      password: 'password123',
    }));
    expect(setUser).toHaveBeenCalledWith({ id: '1', email: 'a@b.com', role: 'user' });
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/setup-profile'));
  });
});
