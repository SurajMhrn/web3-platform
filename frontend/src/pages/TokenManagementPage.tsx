import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useAuth } from '../contexts/AuthContext';
import { useAppKitAccount, useAppKitProvider, useAppKitNetwork } from '@reown/appkit/react';
import { BrowserProvider, Contract, ethers } from 'ethers';
import toast from 'react-hot-toast';
import { getDeploymentForChain } from '../services/web3Service';
import { apiClient, getErrorMessage } from '../services/apiClient';

interface Token {
  id: string;
  name: string;
  symbol: string;
  initial_supply: number;
  contract_address: string;
  tx_hash: string;
  chain_id: string;
  created_at: string;
}

const deploySchema = z.object({
  name: z.string().min(1, { message: 'Name is required' }),
  symbol: z.string().min(1, { message: 'Symbol is required' }).max(10, { message: 'Symbol must be 10 characters or fewer' }),
  supply: z.coerce.number({ message: 'Enter a valid number' }).positive({ message: 'Initial supply must be positive' }),
});
type DeployFormData = z.infer<typeof deploySchema>;

const transferSchema = z.object({
  tokenId: z.string().min(1, { message: 'Select a token' }),
  transferTo: z.string().refine((v) => ethers.isAddress(v), { message: 'Invalid recipient address' }),
  transferAmount: z.coerce.number({ message: 'Enter a valid number' }).positive({ message: 'Amount must be positive' }),
});
type TransferFormData = z.infer<typeof transferSchema>;

export function TokenManagementPage() {
  const { isAuthenticated } = useAuth();
  const [tokens, setTokens] = useState<Token[]>([]);
  const [loading, setLoading] = useState(true);
  const [deploying, setDeploying] = useState(false);
  const [transferring, setTransferring] = useState(false);

  // Wallet
  const { isConnected, address } = useAppKitAccount();
  const { walletProvider } = useAppKitProvider('eip155');
  const { chainId } = useAppKitNetwork();

  // z.coerce.number() makes the schema's *input* type (raw form values, e.g.
  // `supply: unknown`) differ from its *output* type (`supply: number`) —
  // the 3-generic useForm form below tells react-hook-form about both, so
  // `register`/defaultValues use the raw input type and `handleSubmit`'s
  // callback receives the coerced output type.
  const deployForm = useForm<z.input<typeof deploySchema>, unknown, z.output<typeof deploySchema>>({
    resolver: zodResolver(deploySchema),
  });
  const transferForm = useForm<z.input<typeof transferSchema>, unknown, z.output<typeof transferSchema>>({
    resolver: zodResolver(transferSchema),
  });

  const fetchTokens = async () => {
    if (!isAuthenticated) return;
    try {
      setLoading(true);
      const res = await apiClient.get('/tokens');
      setTokens(res.data.tokens);
    } catch {
      toast.error('Failed to load tokens');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTokens();
  }, [isAuthenticated]);

  // Deploys a new CustomToken via TokenFactory.createToken() directly from the
  // connected wallet (the wallet pays gas and becomes the token's owner), then
  // records the result in the backend for the user/transaction/notification
  // history — the on-chain call is the source of truth, the backend call is
  // just bookkeeping. The new token's address isn't returned by the factory
  // call itself, so it's recovered from the TokenCreated event log instead.
  const handleDeployToken = async (data: DeployFormData) => {
    if (!isConnected || !walletProvider || !chainId || !address) {
      return toast.error('Connect your wallet first');
    }

    try {
      setDeploying(true);
      const provider = new BrowserProvider(walletProvider as any);
      const signer = await provider.getSigner();

      const deployment = getDeploymentForChain(chainId.toString());
      const { address: factoryAddress, abi: factoryAbi } = deployment.contracts.TokenFactory;

      const factory = new Contract(factoryAddress, factoryAbi, signer);

      toast.loading('Deploying token...', { id: 'deploy' });
      const tx = await factory.createToken(data.name, data.symbol, data.supply);
      const receipt = await tx.wait();

      // Get token address from event
      const event = receipt.logs.map((log: any) => {
        try { return factory.interface.parseLog(log); } catch { return null; }
      }).find((e: any) => e && e.name === 'TokenCreated');

      if (!event) throw new Error('Token created event not found');

      const tokenAddress = event.args[0];

      await apiClient.post('/tokens/record', {
        name: data.name,
        symbol: data.symbol,
        initialSupply: data.supply,
        contractAddress: tokenAddress,
        txHash: receipt.hash,
        chainId: chainId.toString()
      });

      toast.success('Token deployed successfully!', { id: 'deploy' });
      deployForm.reset();
      fetchTokens();
    } catch (err: any) {
      toast.error(getErrorMessage(err, err.reason || err.message || 'Deployment failed'), { id: 'deploy' });
    } finally {
      setDeploying(false);
    }
  };

  // Transfers tokens via a direct ERC20 `transfer()` call on the token
  // contract (not through TokenFactory — the factory only deploys tokens),
  // then records the transfer in the backend once the transaction confirms.
  const handleTransfer = async (data: TransferFormData) => {
    const selectedToken = tokens.find(t => t.id === data.tokenId);
    if (!selectedToken) return toast.error('Select a token');
    if (!isConnected || !walletProvider || !chainId || !address) {
      return toast.error('Connect your wallet first');
    }

    try {
      setTransferring(true);
      const provider = new BrowserProvider(walletProvider as any);
      const signer = await provider.getSigner();

      const deployment = getDeploymentForChain(chainId.toString());
      const { abi: tokenAbi } = deployment.contracts.CustomToken;

      const tokenContract = new Contract(selectedToken.contract_address, tokenAbi, signer);

      // Format to 18 decimals (assuming standard ERC20)
      // Since CustomToken mints `amount * 10**decimals()`, the user enters whole units
      const weiAmount = ethers.parseUnits(data.transferAmount.toString(), 18);

      toast.loading('Transferring tokens...', { id: 'transfer' });
      const tx = await tokenContract.transfer(data.transferTo, weiAmount);
      const receipt = await tx.wait();

      await apiClient.post('/tokens/transfer-record', {
        tokenName: selectedToken.name,
        tokenSymbol: selectedToken.symbol,
        contractAddress: selectedToken.contract_address,
        toAddress: data.transferTo,
        amount: data.transferAmount,
        txHash: receipt.hash,
        chainId: chainId.toString()
      });

      toast.success('Transfer successful!', { id: 'transfer' });
      transferForm.reset();
    } catch (err: any) {
      toast.error(getErrorMessage(err, err.reason || err.message || 'Transfer failed'), { id: 'transfer' });
    } finally {
      setTransferring(false);
    }
  };

  return (
    <div className="app-container">
      <div className="glass-card" style={{ maxWidth: '1000px', width: '100%' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
          <div>
            <h2 className="title" style={{ textAlign: 'left', marginBottom: '0.2rem' }}>Token Management</h2>
            <p className="subtitle" style={{ textAlign: 'left', margin: 0 }}>Deploy and manage your ERC20 tokens</p>
          </div>
          <Link to="/dashboard" className="btn secondary-btn" style={{ width: 'auto', padding: '0.5rem 1rem' }}>
            ← Back
          </Link>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '2rem' }}>

          {/* Create Token Form */}
          <div className="blockchain-panel">
            <h3 className="blockchain-panel-title" style={{ marginBottom: '1.5rem' }}>✨ Create New Token</h3>
            <form onSubmit={deployForm.handleSubmit(handleDeployToken)} noValidate>
              <div className="input-group">
                <label>Token Name</label>
                <input type="text" placeholder="e.g. My Awesome Token" {...deployForm.register('name')} />
                {deployForm.formState.errors.name && (
                  <p className="error-message">{deployForm.formState.errors.name.message}</p>
                )}
              </div>
              <div className="input-group">
                <label>Token Symbol</label>
                <input type="text" placeholder="e.g. MAT" maxLength={10} {...deployForm.register('symbol')} />
                {deployForm.formState.errors.symbol && (
                  <p className="error-message">{deployForm.formState.errors.symbol.message}</p>
                )}
              </div>
              <div className="input-group">
                <label>Initial Supply</label>
                <input type="number" placeholder="e.g. 1000000" min="1" {...deployForm.register('supply')} />
                {deployForm.formState.errors.supply && (
                  <p className="error-message">{deployForm.formState.errors.supply.message}</p>
                )}
              </div>
              <button type="submit" className="btn primary-btn" disabled={deploying || !isConnected}>
                {deploying ? <div className="spinner" /> : 'Deploy Token'}
              </button>
            </form>
          </div>

          {/* Transfer Token Form */}
          <div className="blockchain-panel">
            <h3 className="blockchain-panel-title" style={{ marginBottom: '1.5rem' }}>↗️ Transfer Tokens</h3>
            <form onSubmit={transferForm.handleSubmit(handleTransfer)} noValidate>
              <div className="input-group">
                <label>Select Token</label>
                <select
                  className="admin-search"
                  style={{ width: '100%' }}
                  defaultValue=""
                  {...transferForm.register('tokenId')}
                >
                  <option value="">-- Choose a token --</option>
                  {tokens.map(t => (
                    <option key={t.id} value={t.id}>{t.name} ({t.symbol})</option>
                  ))}
                </select>
                {transferForm.formState.errors.tokenId && (
                  <p className="error-message">{transferForm.formState.errors.tokenId.message}</p>
                )}
              </div>
              <div className="input-group">
                <label>Recipient Address</label>
                <input type="text" placeholder="0x..." {...transferForm.register('transferTo')} />
                {transferForm.formState.errors.transferTo && (
                  <p className="error-message">{transferForm.formState.errors.transferTo.message}</p>
                )}
              </div>
              <div className="input-group">
                <label>Amount</label>
                <input type="number" placeholder="0.0" min="0.000001" step="any" {...transferForm.register('transferAmount')} />
                {transferForm.formState.errors.transferAmount && (
                  <p className="error-message">{transferForm.formState.errors.transferAmount.message}</p>
                )}
              </div>
              <button type="submit" className="btn primary-btn" disabled={transferring || !isConnected}>
                {transferring ? <div className="spinner" /> : 'Transfer'}
              </button>
            </form>
          </div>
        </div>

        {/* My Tokens List */}
        <div className="blockchain-panel" style={{ marginTop: '2rem' }}>
          <h3 className="blockchain-panel-title" style={{ marginBottom: '1.5rem' }}>📦 My Tokens</h3>
          {loading ? (
            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
              <div className="spinner" /> <p>Loading tokens...</p>
            </div>
          ) : tokens.length === 0 ? (
            <p className="empty-state">You haven't created any tokens yet.</p>
          ) : (
            <div className="table-responsive">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Symbol</th>
                    <th>Initial Supply</th>
                    <th>Contract Address</th>
                    <th>Created</th>
                  </tr>
                </thead>
                <tbody>
                  {tokens.map(t => (
                    <tr key={t.id}>
                      <td style={{ fontWeight: 600 }}>{t.name}</td>
                      <td><span className="admin-wallet">{t.symbol}</span></td>
                      <td>{Number(t.initial_supply).toLocaleString()}</td>
                      <td><code className="tx-hash">{t.contract_address.slice(0, 10)}...{t.contract_address.slice(-6)}</code></td>
                      <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{new Date(t.created_at).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
