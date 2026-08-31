import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { TokenManagementPage } from './TokenManagementPage';
import { useAuth } from '../contexts/AuthContext';
import { apiClient } from '../services/apiClient';
import { useAppKitAccount, useAppKitProvider, useAppKitNetwork } from '@reown/appkit/react';
import { Contract } from 'ethers';

vi.mock('../contexts/AuthContext', () => ({
  useAuth: vi.fn(),
}));

vi.mock('../services/apiClient', () => ({
  apiClient: { get: vi.fn(), post: vi.fn() },
  getErrorMessage: (_err: unknown, fallback: string) => fallback,
}));

vi.mock('@reown/appkit/react', () => ({
  useAppKitAccount: vi.fn(),
  useAppKitProvider: vi.fn(),
  useAppKitNetwork: vi.fn(),
}));

vi.mock('ethers', async (importOriginal) => {
  const actual = await importOriginal<typeof import('ethers')>();
  return {
    ...actual,
    // Regular `function`, not an arrow — the component calls these with
    // `new`, and arrow functions have no [[Construct]] behavior at all.
    BrowserProvider: vi.fn().mockImplementation(function () {
      return { getSigner: vi.fn().mockResolvedValue({}) };
    }),
    Contract: vi.fn(),
  };
});

const TOKEN = {
  id: 'tok-1',
  name: 'My Token',
  symbol: 'MYT',
  initial_supply: 1000,
  contract_address: '0x' + '1'.repeat(40),
  tx_hash: '0x' + '1'.repeat(64),
  chain_id: '31337',
  created_at: new Date().toISOString(),
};

const VALID_RECIPIENT = '0x000000000000000000000000000000000000dEaD';

function connectedWallet() {
  vi.mocked(useAppKitAccount).mockReturnValue({
    address: '0x000000000000000000000000000000000000bEEF',
    isConnected: true,
  } as unknown as ReturnType<typeof useAppKitAccount>);
  vi.mocked(useAppKitProvider).mockReturnValue({ walletProvider: {} } as unknown as ReturnType<typeof useAppKitProvider>);
  vi.mocked(useAppKitNetwork).mockReturnValue({ chainId: 31337 } as unknown as ReturnType<typeof useAppKitNetwork>);
}

describe('TokenManagementPage', () => {
  beforeEach(() => {
    vi.mocked(apiClient.get).mockReset();
    vi.mocked(apiClient.post).mockReset();
    vi.mocked(Contract).mockReset();
    vi.mocked(useAuth).mockReturnValue({ isAuthenticated: true } as unknown as ReturnType<typeof useAuth>);
    vi.mocked(apiClient.get).mockResolvedValue({ data: { tokens: [TOKEN] } });
    vi.mocked(useAppKitAccount).mockReturnValue({ address: undefined, isConnected: false } as unknown as ReturnType<typeof useAppKitAccount>);
    vi.mocked(useAppKitProvider).mockReturnValue({ walletProvider: undefined } as unknown as ReturnType<typeof useAppKitProvider>);
    vi.mocked(useAppKitNetwork).mockReturnValue({ chainId: undefined } as unknown as ReturnType<typeof useAppKitNetwork>);
  });

  it('lists the user\'s tokens fetched on mount', async () => {
    render(<MemoryRouter><TokenManagementPage /></MemoryRouter>);
    expect(await screen.findByText('My Token')).toBeInTheDocument();
    expect(screen.getByText('MYT')).toBeInTheDocument();
  });

  it('disables both submit buttons when the wallet is not connected', async () => {
    render(<MemoryRouter><TokenManagementPage /></MemoryRouter>);
    await screen.findByText('My Token');
    expect(screen.getByRole('button', { name: /deploy token/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /^transfer$/i })).toBeDisabled();
  });

  it('rejects an invalid recipient address on the transfer form', async () => {
    connectedWallet();
    const user = userEvent.setup();
    render(<MemoryRouter><TokenManagementPage /></MemoryRouter>);
    await screen.findByText('My Token');

    await user.selectOptions(screen.getByDisplayValue('-- Choose a token --'), 'tok-1');
    await user.type(screen.getByPlaceholderText('0x...'), 'not-an-address');
    await user.type(screen.getByPlaceholderText('0.0'), '10');
    await user.click(screen.getByRole('button', { name: /^transfer$/i }));

    expect(await screen.findByText('Invalid recipient address')).toBeInTheDocument();
    expect(Contract).not.toHaveBeenCalled();
  });

  it('rejects a non-positive initial supply on the deploy form', async () => {
    connectedWallet();
    const user = userEvent.setup();
    render(<MemoryRouter><TokenManagementPage /></MemoryRouter>);
    await screen.findByText('My Token');

    await user.type(screen.getByPlaceholderText('e.g. My Awesome Token'), 'New Token');
    await user.type(screen.getByPlaceholderText('e.g. MAT'), 'NEW');
    await user.type(screen.getByPlaceholderText('e.g. 1000000'), '0');
    await user.click(screen.getByRole('button', { name: /deploy token/i }));

    expect(await screen.findByText('Initial supply must be positive')).toBeInTheDocument();
    expect(Contract).not.toHaveBeenCalled();
  });

  it('deploys a token: calls the factory contract, then records it via the API', async () => {
    connectedWallet();

    const mockTx = {
      wait: vi.fn().mockResolvedValue({
        hash: '0x' + 'a'.repeat(64),
        logs: ['raw-log'],
      }),
    };
    const mockFactory = {
      createToken: vi.fn().mockResolvedValue(mockTx),
      interface: {
        parseLog: vi.fn().mockReturnValue({
          name: 'TokenCreated',
          args: ['0x2222222222222222222222222222222222222222'],
        }),
      },
    };
    vi.mocked(Contract).mockImplementation(function () {
      return mockFactory as unknown as Contract;
    });
    vi.mocked(apiClient.post).mockResolvedValueOnce({ data: { token: {} } });

    const user = userEvent.setup();
    render(<MemoryRouter><TokenManagementPage /></MemoryRouter>);
    await screen.findByText('My Token');

    await user.type(screen.getByPlaceholderText('e.g. My Awesome Token'), 'New Token');
    await user.type(screen.getByPlaceholderText('e.g. MAT'), 'NEW');
    await user.type(screen.getByPlaceholderText('e.g. 1000000'), '500');
    await user.click(screen.getByRole('button', { name: /deploy token/i }));

    await waitFor(() => expect(mockFactory.createToken).toHaveBeenCalledWith('New Token', 'NEW', 500));
    await waitFor(() => expect(apiClient.post).toHaveBeenCalledWith('/tokens/record', expect.objectContaining({
      name: 'New Token',
      symbol: 'NEW',
      initialSupply: 500,
      contractAddress: '0x2222222222222222222222222222222222222222',
      chainId: '31337',
    })));
  });

  it('transfers tokens: converts the decimal amount to 18-decimal wei before calling transfer()', async () => {
    connectedWallet();

    const mockTx = { wait: vi.fn().mockResolvedValue({ hash: '0x' + 'b'.repeat(64) }) };
    const mockToken = { transfer: vi.fn().mockResolvedValue(mockTx) };
    vi.mocked(Contract).mockImplementation(function () {
      return mockToken as unknown as Contract;
    });
    vi.mocked(apiClient.post).mockResolvedValueOnce({ data: { transaction: {} } });

    const user = userEvent.setup();
    render(<MemoryRouter><TokenManagementPage /></MemoryRouter>);
    await screen.findByText('My Token');

    await user.selectOptions(screen.getByDisplayValue('-- Choose a token --'), 'tok-1');
    await user.type(screen.getByPlaceholderText('0x...'), VALID_RECIPIENT);
    await user.type(screen.getByPlaceholderText('0.0'), '2.5');
    await user.click(screen.getByRole('button', { name: /^transfer$/i }));

    await waitFor(() =>
      expect(mockToken.transfer).toHaveBeenCalledWith(VALID_RECIPIENT, 2_500_000_000_000_000_000n)
    );
    await waitFor(() => expect(apiClient.post).toHaveBeenCalledWith('/tokens/transfer-record', expect.objectContaining({
      contractAddress: TOKEN.contract_address,
      toAddress: VALID_RECIPIENT,
      amount: 2.5,
    })));
  });
});
