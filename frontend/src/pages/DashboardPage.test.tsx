import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { DashboardPage } from './DashboardPage';
import { useAuth } from '../contexts/AuthContext';
import { apiClient } from '../services/apiClient';
import { useAppKitAccount, useAppKitProvider, useAppKitNetwork, useDisconnect } from '@reown/appkit/react';

vi.mock('../contexts/AuthContext', () => ({
  useAuth: vi.fn(),
}));

vi.mock('../services/apiClient', () => ({
  // `get` backs NotificationBell's unread-count poll (rendered inside
  // DashboardPage) — resolved so it doesn't reject unhandled mid-test.
  apiClient: { post: vi.fn(), get: vi.fn().mockResolvedValue({ data: { count: 0 } }) },
  getErrorMessage: (_err: unknown, fallback: string) => fallback,
}));

vi.mock('@reown/appkit/react', () => ({
  useAppKitAccount: vi.fn(),
  useAppKitProvider: vi.fn(),
  useAppKitNetwork: vi.fn(),
  useDisconnect: vi.fn(),
}));

const mockUseAuth = vi.mocked(useAuth);

const WALLET_ADDRESS = '0x000000000000000000000000000000000000bEEF';

const baseUser = {
  id: '1',
  email: 'alice@example.com',
  username: 'alice',
  role: 'user' as const,
};

describe('DashboardPage — wallet link/unlink', () => {
  beforeEach(() => {
    vi.mocked(apiClient.post).mockReset();
    // No live wallet connection needed to exercise unlink — only linking
    // requires a connected wallet + signer.
    vi.mocked(useAppKitAccount).mockReturnValue({ address: undefined, isConnected: false } as unknown as ReturnType<typeof useAppKitAccount>);
    vi.mocked(useAppKitProvider).mockReturnValue({ walletProvider: undefined } as unknown as ReturnType<typeof useAppKitProvider>);
    vi.mocked(useAppKitNetwork).mockReturnValue({ chainId: undefined } as unknown as ReturnType<typeof useAppKitNetwork>);
    vi.mocked(useDisconnect).mockReturnValue({ disconnect: vi.fn().mockResolvedValue(undefined) } as unknown as ReturnType<typeof useDisconnect>);
  });

  it('shows the linked address and a Disconnect Wallet button when a wallet is linked', () => {
    mockUseAuth.mockReturnValue({
      user: { ...baseUser, wallet_address: WALLET_ADDRESS },
      isAuthenticated: true,
      logout: vi.fn(),
      setUser: vi.fn(),
      isAdmin: false,
    } as unknown as ReturnType<typeof useAuth>);

    render(<MemoryRouter><DashboardPage /></MemoryRouter>);

    expect(screen.getByText(/0xbeef|0x0000/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /disconnect wallet/i })).toBeInTheDocument();
  });

  it('shows the "link to account" prompt (not the disconnect button) when no wallet is linked', () => {
    mockUseAuth.mockReturnValue({
      user: { ...baseUser, wallet_address: undefined },
      isAuthenticated: true,
      logout: vi.fn(),
      setUser: vi.fn(),
      isAdmin: false,
    } as unknown as ReturnType<typeof useAuth>);

    render(<MemoryRouter><DashboardPage /></MemoryRouter>);

    expect(screen.getByText(/haven't linked a web3 wallet/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /disconnect wallet/i })).not.toBeInTheDocument();
  });

  it('disconnecting calls the API, updates the user, and reveals the link-wallet prompt again', async () => {
    const setUser = vi.fn();
    mockUseAuth.mockReturnValue({
      user: { ...baseUser, wallet_address: WALLET_ADDRESS },
      isAuthenticated: true,
      logout: vi.fn(),
      setUser,
      isAdmin: false,
    } as unknown as ReturnType<typeof useAuth>);
    vi.mocked(apiClient.post).mockResolvedValueOnce({
      data: { user: { ...baseUser, wallet_address: null } },
    });

    const user = userEvent.setup();
    render(<MemoryRouter><DashboardPage /></MemoryRouter>);

    await user.click(screen.getByRole('button', { name: /disconnect wallet/i }));

    await waitFor(() => expect(apiClient.post).toHaveBeenCalledWith('/auth/unlink-wallet'));
    expect(setUser).toHaveBeenCalledWith({ ...baseUser, wallet_address: null });
  });

  it('offers "Use a Different Wallet" once connected but before linking, and it ends the AppKit session', async () => {
    mockUseAuth.mockReturnValue({
      user: { ...baseUser, wallet_address: undefined },
      isAuthenticated: true,
      logout: vi.fn(),
      setUser: vi.fn(),
      isAdmin: false,
    } as unknown as ReturnType<typeof useAuth>);
    vi.mocked(useAppKitAccount).mockReturnValue({ address: WALLET_ADDRESS, isConnected: true } as unknown as ReturnType<typeof useAppKitAccount>);
    vi.mocked(useAppKitProvider).mockReturnValue({ walletProvider: {} } as unknown as ReturnType<typeof useAppKitProvider>);
    const disconnect = vi.fn().mockResolvedValue(undefined);
    vi.mocked(useDisconnect).mockReturnValue({ disconnect } as unknown as ReturnType<typeof useDisconnect>);

    const user = userEvent.setup();
    render(<MemoryRouter><DashboardPage /></MemoryRouter>);

    const switchBtn = screen.getByRole('button', { name: /use a different wallet/i });
    expect(switchBtn).toBeInTheDocument();
    // This is a live-wallet-session action, not an account mutation.
    expect(screen.queryByRole('button', { name: /disconnect wallet/i })).not.toBeInTheDocument();

    await user.click(switchBtn);
    await waitFor(() => expect(disconnect).toHaveBeenCalled());
  });

  it('shows an error and keeps the wallet linked if the API call fails', async () => {
    const setUser = vi.fn();
    mockUseAuth.mockReturnValue({
      user: { ...baseUser, wallet_address: WALLET_ADDRESS },
      isAuthenticated: true,
      logout: vi.fn(),
      setUser,
      isAdmin: false,
    } as unknown as ReturnType<typeof useAuth>);
    vi.mocked(apiClient.post).mockRejectedValueOnce(new Error('network error'));

    const user = userEvent.setup();
    render(<MemoryRouter><DashboardPage /></MemoryRouter>);

    await user.click(screen.getByRole('button', { name: /disconnect wallet/i }));

    await waitFor(() => expect(apiClient.post).toHaveBeenCalledWith('/auth/unlink-wallet'));
    expect(setUser).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: /disconnect wallet/i })).toBeInTheDocument();
  });
});
