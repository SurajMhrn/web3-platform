import { useAuth } from '../contexts/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import { useEffect, useState, useCallback } from 'react';
import { useAppKitAccount, useAppKitProvider, useAppKitNetwork, useDisconnect } from '@reown/appkit/react';
import { BrowserProvider } from 'ethers';
import toast from 'react-hot-toast';
import {
  getOnChainUser,
  registerUserOnChain,
  getExplorerUrl,
  type OnChainUser,
} from '../services/web3Service';
import { apiClient, getErrorMessage } from '../services/apiClient';
import { NotificationBell } from '../components/NotificationBell';

const ROLE_LABELS: Record<string, { label: string; className: string }> = {
  admin:     { label: 'Admin',     className: 'role-badge role-badge--admin' },
  moderator: { label: 'Moderator', className: 'role-badge role-badge--mod' },
  user:      { label: 'User',      className: 'role-badge role-badge--user' },
};

export function DashboardPage() {
  const { user, isAuthenticated, logout, setUser, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [unlinking, setUnlinking] = useState(false);

  // Wallet state
  const { address, isConnected } = useAppKitAccount();
  const { walletProvider } = useAppKitProvider('eip155');
  const { chainId } = useAppKitNetwork();
  const { disconnect } = useDisconnect();
  const [switchingWallet, setSwitchingWallet] = useState(false);

  // Blockchain registration state
  const [onChainUser, setOnChainUser] = useState<OnChainUser | null>(null);
  const [chainLoading, setChainLoading] = useState(false);
  const [registering, setRegistering] = useState(false);
  const [lastTxHash, setLastTxHash] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuthenticated) navigate('/login');
  }, [isAuthenticated, navigate]);

  // ── Load on-chain status when wallet connects ──────────────────────────────
  const refreshChainStatus = useCallback(async () => {
    if (!isConnected || !address || !chainId || !walletProvider) return;
    try {
      setChainLoading(true);
      const provider = new BrowserProvider(walletProvider as any);
      const cid = chainId.toString();

      // Race the RPC call against a 5-second timeout so we don't hang
      // indefinitely if the local node is unreachable.
      const timeout = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('RPC timeout')), 5000)
      );
      const onChain = await Promise.race([
        getOnChainUser(provider, address, cid),
        timeout,
      ]);
      setOnChainUser(onChain);
    } catch (err) {
      // Silently fail — unsupported network, no deployment, or node offline
      setOnChainUser(null);
    } finally {
      setChainLoading(false);
    }
  }, [isConnected, address, chainId, walletProvider]);

  useEffect(() => {
    refreshChainStatus();
  }, [refreshChainStatus]);

  // ── Register on blockchain ─────────────────────────────────────────────────
  const handleRegisterOnChain = async () => {
    if (!isConnected || !walletProvider || !address || !chainId) {
      toast.error('Connect your wallet first.');
      return;
    }
    if (!user?.username) {
      toast.error('Set up your profile before registering on-chain.');
      return;
    }

    try {
      setRegistering(true);
      const provider = new BrowserProvider(walletProvider as any);
      const signer = await provider.getSigner();

      const txHash = await registerUserOnChain({
        signer,
        chainId: chainId.toString(),
        username: user.username,
        email: user.email,
        role: user.role,
      });

      setLastTxHash(txHash);
      toast.success('Registered on blockchain!');
      await refreshChainStatus();
    } catch (err: any) {
      const msg = err?.reason || err?.message || 'Transaction failed';
      toast.error(msg);
    } finally {
      setRegistering(false);
    }
  };

  // ── Link wallet to off-chain account ──────────────────────────────────────
  // Proves wallet ownership without a transaction: the backend hands out a
  // one-time nonce, the wallet signs a plain-text message embedding it (so
  // the user can read exactly what they're signing — never blind/typed-data
  // signing), and the backend recovers the signer address from that
  // signature to confirm it matches the claimed wallet before linking it.
  const handleLinkWallet = async () => {
    if (!isConnected || !walletProvider || !address) {
      toast.error('Please connect your wallet first.');
      return;
    }
    if (user?.wallet_address?.toLowerCase() === address.toLowerCase()) {
      toast.success('This wallet is already linked to your account!');
      return;
    }

    try {
      setLoading(true);
      const nonceRes = await apiClient.post('/auth/nonce');
      const { nonce } = nonceRes.data;

      const ethersProvider = new BrowserProvider(walletProvider as any);
      const signer = await ethersProvider.getSigner();
      const message = `Please sign this message to link your wallet. Nonce: ${nonce}`;
      const signature = await signer.signMessage(message);

      const linkRes = await apiClient.post('/auth/link-wallet', {
        walletAddress: address, signature
      });

      setUser(linkRes.data.user);
      toast.success('Wallet linked successfully!');
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to link wallet.'));
    } finally {
      setLoading(false);
    }
  };

  // ── Unlink wallet from off-chain account ────────────────────────────────────
  // Only clears the account-level association in the backend — it doesn't
  // touch the browser's live wallet connection (that's AppKit's own
  // connect/disconnect, separate from "which address is linked to this
  // account"). Once unlinked, the address is free to be linked elsewhere,
  // and this account can link a different wallet in its place.
  const handleUnlinkWallet = async () => {
    try {
      setUnlinking(true);
      const res = await apiClient.post('/auth/unlink-wallet');
      setUser(res.data.user);
      toast.success('Wallet disconnected from your account.');
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to disconnect wallet.'));
    } finally {
      setUnlinking(false);
    }
  };

  // ── Disconnect the connected (but not yet linked) wallet ────────────────────
  // For when the wrong wallet got connected before linking — ends AppKit's
  // live session so `isConnected` drops and its connect button reappears,
  // ready to pick a different wallet. This never touches the account's
  // stored `wallet_address`; that's what `handleUnlinkWallet` is for.
  const handleSwitchWallet = async () => {
    try {
      setSwitchingWallet(true);
      await disconnect();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to disconnect wallet.'));
    } finally {
      setSwitchingWallet(false);
    }
  };

  if (!isAuthenticated || !user) {
    return <div className="loading-screen"><div className="spinner"></div><p>Loading user data...</p></div>;
  }

  const roleInfo = ROLE_LABELS[user.role] ?? ROLE_LABELS['user'];
  const explorerUrl = lastTxHash && chainId ? getExplorerUrl(chainId.toString(), lastTxHash) : null;

  return (
    <div className="app-container">
      <div className="glass-card dashboard-card">

        {/* Profile Header */}
        <div className="profile-section">
          <img
            src={user.profile_picture || `https://api.dicebear.com/7.x/identicon/svg?seed=${user.email}`}
            alt="Profile"
            className="profile-pic"
          />
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '0.2rem' }}>
              <h2 className="title" style={{ textAlign: 'left', margin: 0 }}>
                Welcome, {user.username || 'User'}!
              </h2>
              <span className={roleInfo.className}>{roleInfo.label}</span>
            </div>
            <p style={{ color: '#cbd5e1' }}>{user.bio || 'No bio provided.'}</p>
          </div>
          <NotificationBell />
        </div>

        {/* Dashboard Navigation */}
        <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem', flexWrap: 'wrap' }}>
          <Link to="/tokens" className="btn primary-btn" style={{ flex: 1, padding: '0.75rem' }}>
            🪙 Token Management
          </Link>
          <Link to="/transactions" className="btn secondary-btn" style={{ flex: 1, padding: '0.75rem' }}>
            📜 Transaction History
          </Link>
        </div>

        {/* Admin Shortcut */}
        {isAdmin && (
          <div className="admin-shortcut-banner">
            <span>🛡️ You have admin access.</span>
            <Link to="/admin" className="btn primary-btn" style={{ padding: '0.4rem 1rem', fontSize: '0.85rem' }}>
              Open Admin Panel →
            </Link>
          </div>
        )}

        {/* ── Blockchain Status Panel ─────────────────────────────────────── */}
        <div className="blockchain-panel">
          <div className="blockchain-panel-header">
            <h3 className="blockchain-panel-title">⛓️ Blockchain Status</h3>
            {isConnected && (
              <appkit-network-button />
            )}
          </div>

          {!isConnected ? (
            <div className="blockchain-disconnected">
              <p>Connect your wallet to interact with the blockchain.</p>
              <div style={{ display: 'flex', justifyContent: 'center', marginTop: '1rem' }}>
                <appkit-button />
              </div>
            </div>
          ) : chainLoading ? (
            <div className="blockchain-loading">
              <div className="spinner" />
              <span>Checking on-chain status…</span>
            </div>
          ) : onChainUser ? (
            <div className="blockchain-registered">
              <div className="blockchain-status-row">
                <span className="status-dot status-dot--green" />
                <span className="status-text">Registered on-chain</span>
              </div>
              <div className="blockchain-info-grid">
                <div className="blockchain-info-item">
                  <span className="bi-label">On-chain username</span>
                  <span className="bi-value">{onChainUser.username}</span>
                </div>
                <div className="blockchain-info-item">
                  <span className="bi-label">On-chain role</span>
                  <span className="bi-value">{onChainUser.role}</span>
                </div>
                <div className="blockchain-info-item">
                  <span className="bi-label">Registered at</span>
                  <span className="bi-value">{new Date(onChainUser.registeredAt * 1000).toLocaleDateString()}</span>
                </div>
                <div className="blockchain-info-item">
                  <span className="bi-label">Status</span>
                  <span className={`bi-value ${onChainUser.isActive ? 'text-green' : 'text-red'}`}>
                    {onChainUser.isActive ? '✅ Active' : '❌ Deactivated'}
                  </span>
                </div>
              </div>
              {lastTxHash && (
                <div className="blockchain-tx">
                  <span className="bi-label">Last Tx: </span>
                  {explorerUrl ? (
                    <a href={explorerUrl} target="_blank" rel="noreferrer" className="tx-link">
                      {lastTxHash.slice(0, 10)}…{lastTxHash.slice(-6)}
                    </a>
                  ) : (
                    <code className="tx-hash">{lastTxHash.slice(0, 10)}…{lastTxHash.slice(-6)}</code>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="blockchain-unregistered">
              <div className="blockchain-status-row">
                <span className="status-dot status-dot--amber" />
                <span className="status-text">Not registered on-chain</span>
              </div>
              <p className="blockchain-hint">
                Register your identity on the blockchain to participate in the platform's on-chain features.
              </p>
              <button
                className="btn primary-btn"
                style={{ marginTop: '1rem', maxWidth: '280px', margin: '1rem auto 0' }}
                onClick={handleRegisterOnChain}
                disabled={registering}
              >
                {registering ? <div className="spinner" /> : '🔗 Register on Blockchain'}
              </button>
            </div>
          )}
        </div>

        {/* ── Web3 Wallet Linking ─────────────────────────────────────────── */}
        <div className="web3-section">
          <h3 style={{ marginBottom: '1rem' }}>Web3 Identity</h3>

          {user.wallet_address ? (
            <div style={{ padding: '1rem', background: 'rgba(99, 102, 241, 0.1)', borderRadius: '8px', border: '1px solid rgba(99, 102, 241, 0.3)' }}>
              <p style={{ color: '#94a3b8', marginBottom: '0.5rem' }}>Linked Wallet Address</p>
              <code style={{ fontSize: '1.1rem', color: '#818cf8' }}>
                {user.wallet_address.substring(0, 6)}...{user.wallet_address.substring(user.wallet_address.length - 4)}
              </code>
              <p style={{ color: '#94a3b8', fontSize: '0.85rem', margin: '0.75rem 0 0' }}>
                To link a different wallet, disconnect this one first, then switch accounts in your wallet extension before linking again.
              </p>
              <button
                className="btn secondary-btn"
                onClick={handleUnlinkWallet}
                disabled={unlinking}
                style={{
                  marginTop: '0.75rem',
                  maxWidth: '260px',
                  background: 'rgba(239, 68, 68, 0.1)',
                  border: '1px solid rgba(239, 68, 68, 0.2)',
                  color: '#ef4444',
                }}
              >
                {unlinking ? <div className="spinner" /> : 'Disconnect Wallet'}
              </button>
            </div>
          ) : (
            <div>
              <p style={{ color: '#94a3b8', marginBottom: '1rem' }}>You haven't linked a Web3 wallet yet.</p>
              {!isConnected ? (
                <div className="wallet-btn-container">
                  <appkit-button />
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
                  <p style={{ color: '#10b981' }}>
                    Wallet connected: {address?.substring(0, 6)}...{address?.substring(address.length - 4)}
                  </p>
                  <button
                    className="btn primary-btn"
                    onClick={handleLinkWallet}
                    disabled={loading}
                    style={{ maxWidth: '300px' }}
                  >
                    {loading ? <div className="spinner" /> : 'Link to Account'}
                  </button>
                  <button
                    className="btn secondary-btn"
                    onClick={handleSwitchWallet}
                    disabled={switchingWallet}
                    style={{ maxWidth: '300px' }}
                  >
                    {switchingWallet ? <div className="spinner" /> : 'Use a Different Wallet'}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        <button
          className="btn secondary-btn"
          onClick={logout}
          style={{
            marginTop: '2rem',
            background: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.2)',
            color: '#ef4444'
          }}
        >
          Logout
        </button>
      </div>
    </div>
  );
}
