import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuth } from '../contexts/AuthContext';
import { getExplorerUrl } from '../services/web3Service';
import { apiClient, getErrorMessage } from '../services/apiClient';

interface Transaction {
  id: string;
  type: string;
  status: string;
  tx_hash: string;
  chain_id: string;
  description: string;
  metadata?: string;
  created_at: string;
}

export function TransactionHistoryPage() {
  const { isAuthenticated } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isAuthenticated) return;

    const fetchTransactions = async () => {
      try {
        setLoading(true);
        const res = await apiClient.get('/transactions');
        setTransactions(res.data.transactions);
      } catch (err) {
        toast.error(getErrorMessage(err, 'Failed to load transactions'));
      } finally {
        setLoading(false);
      }
    };

    fetchTransactions();
  }, [isAuthenticated]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'success':
        return <span className="status-badge status-success">Success</span>;
      case 'pending':
        return <span className="status-badge status-pending">Pending</span>;
      case 'failed':
        return <span className="status-badge status-failed">Failed</span>;
      default:
        return <span className="status-badge">{status}</span>;
    }
  };

  return (
    <div className="app-container">
      <div className="glass-card" style={{ maxWidth: '900px', width: '100%' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
          <div>
            <h2 className="title" style={{ textAlign: 'left', marginBottom: '0.2rem' }}>Transaction History</h2>
            <p className="subtitle" style={{ textAlign: 'left', margin: 0 }}>View your blockchain activity</p>
          </div>
          <Link to="/dashboard" className="btn secondary-btn" style={{ width: 'auto', padding: '0.5rem 1rem' }}>
            ← Back
          </Link>
        </div>

        {loading ? (
          <div className="loading-screen" style={{ minHeight: '200px' }}>
            <div className="spinner"></div>
            <p>Loading transactions...</p>
          </div>
        ) : transactions.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
            <p style={{ fontSize: '3rem', marginBottom: '1rem' }}>📭</p>
            <p>You have no transactions yet.</p>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Description</th>
                  <th>Status</th>
                  <th>Transaction Hash</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map(tx => {
                  const explorerUrl = getExplorerUrl(tx.chain_id, tx.tx_hash);
                  return (
                    <tr key={tx.id}>
                      <td>
                        <span style={{ textTransform: 'capitalize', color: 'var(--text-muted)' }}>
                          {tx.type.replace('_', ' ')}
                        </span>
                      </td>
                      <td>{tx.description}</td>
                      <td>{getStatusBadge(tx.status)}</td>
                      <td>
                        {explorerUrl ? (
                          <a href={explorerUrl} target="_blank" rel="noreferrer" className="tx-link">
                            {tx.tx_hash.slice(0, 8)}...{tx.tx_hash.slice(-6)}
                          </a>
                        ) : (
                          <code className="tx-hash">{tx.tx_hash.slice(0, 8)}...{tx.tx_hash.slice(-6)}</code>
                        )}
                      </td>
                      <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        {new Date(tx.created_at).toLocaleString()}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
