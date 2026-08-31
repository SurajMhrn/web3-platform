import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import { AuthProvider, useAuth } from './AuthContext';
import { apiClient } from '../services/apiClient';

vi.mock('../services/apiClient', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
  },
  getErrorMessage: (_err: unknown, fallback: string) => fallback,
}));

function Consumer() {
  const { user, isAuthenticated, logout } = useAuth();
  return (
    <div>
      <div data-testid="auth-state">{isAuthenticated ? 'authed' : 'anon'}</div>
      <div data-testid="email">{user?.email ?? 'none'}</div>
      <button onClick={() => logout()}>logout</button>
    </div>
  );
}

describe('AuthProvider', () => {
  beforeEach(() => {
    vi.mocked(apiClient.get).mockReset();
    vi.mocked(apiClient.post).mockReset();
  });

  it('loads the user profile on mount when the session cookie is valid', async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce({
      data: { user: { id: '1', email: 'a@b.com', role: 'user' } },
    });

    render(
      <AuthProvider>
        <Consumer />
      </AuthProvider>
    );

    await waitFor(() => expect(screen.getByTestId('auth-state')).toHaveTextContent('authed'));
    expect(screen.getByTestId('email')).toHaveTextContent('a@b.com');
    expect(apiClient.get).toHaveBeenCalledWith('/auth/profile', expect.any(Object));
  });

  it('starts logged out when there is no valid session (profile fetch fails)', async () => {
    vi.mocked(apiClient.get).mockRejectedValueOnce(new Error('401'));

    render(
      <AuthProvider>
        <Consumer />
      </AuthProvider>
    );

    await waitFor(() => expect(screen.getByTestId('auth-state')).toHaveTextContent('anon'));
    expect(screen.getByTestId('email')).toHaveTextContent('none');
  });

  it('logout clears user state even if the server call fails', async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce({
      data: { user: { id: '1', email: 'a@b.com', role: 'user' } },
    });
    vi.mocked(apiClient.post).mockRejectedValueOnce(new Error('network error'));

    render(
      <AuthProvider>
        <Consumer />
      </AuthProvider>
    );
    await waitFor(() => expect(screen.getByTestId('auth-state')).toHaveTextContent('authed'));

    await act(async () => {
      screen.getByText('logout').click();
    });

    await waitFor(() => expect(screen.getByTestId('auth-state')).toHaveTextContent('anon'));
  });
});
