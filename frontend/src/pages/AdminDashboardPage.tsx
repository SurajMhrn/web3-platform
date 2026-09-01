import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuth } from '../contexts/AuthContext';
import type { UserRole } from '../contexts/AuthContext';
import { NotificationBell } from '../components/NotificationBell';
import { MiniBarChart, type MiniBarChartDatum } from '../components/MiniBarChart';
import { apiClient, getErrorMessage } from '../services/apiClient';

interface AdminStats {
  totalUsers: number;
  totalAdmins: number;
  totalModerators: number;
  walletLinked: number;
  regularUsers: number;
}

interface DayCount {
  day: string;
  count: number;
}

interface TopCreator {
  user_id: string;
  email: string;
  username: string | null;
  token_count: number;
}

interface Analytics {
  days: number;
  signups: DayCount[];
  tokensCreated: DayCount[];
  transactions: DayCount[];
  topCreators: TopCreator[];
}

/**
 * The API only returns rows for days that had activity — this fills in the
 * gaps with zero-count days so the chart represents the full window rather
 * than compressing onto just the days something happened.
 */
function buildDaySeries(counts: DayCount[], days: number): MiniBarChartDatum[] {
  const countByDay = new Map(counts.map(c => [c.day, c.count]));
  const series: MiniBarChartDatum[] = [];
  const today = new Date();

  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    const iso = date.toISOString().slice(0, 10);
    series.push({
      label: date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
      value: countByDay.get(iso) ?? 0,
    });
  }
  return series;
}

interface AdminUser {
  id: string;
  email: string;
  username?: string;
  wallet_address?: string;
  role: UserRole;
  created_at: string;
}

const ROLE_COLORS: Record<UserRole, string> = {
  admin: 'role-badge--admin',
  moderator: 'role-badge--mod',
  user: 'role-badge--user',
};

export function AdminDashboardPage() {
  const { user } = useAuth();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [loadingAnalytics, setLoadingAnalytics] = useState(true);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loadingStats, setLoadingStats] = useState(true);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const LIMIT = 10;

  const fetchStats = useCallback(async () => {
    try {
      setLoadingStats(true);
      const res = await apiClient.get('/admin/stats');
      setStats(res.data.stats);
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to load stats'));
    } finally {
      setLoadingStats(false);
    }
  }, []);

  const fetchAnalytics = useCallback(async () => {
    try {
      setLoadingAnalytics(true);
      const res = await apiClient.get('/admin/analytics?days=14');
      setAnalytics(res.data);
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to load analytics'));
    } finally {
      setLoadingAnalytics(false);
    }
  }, []);

  const fetchUsers = useCallback(async (currentOffset: number) => {
    try {
      setLoadingUsers(true);
      const res = await apiClient.get(`/admin/users?limit=${LIMIT}&offset=${currentOffset}`);
      setUsers(res.data.users);
      setTotal(res.data.total);
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to load users'));
    } finally {
      setLoadingUsers(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
    fetchAnalytics();
    fetchUsers(0);
  }, []);

  const handleRoleChange = async (userId: string, newRole: UserRole) => {
    try {
      const res = await apiClient.patch(`/admin/users/${userId}/role`, { role: newRole });
      toast.success(`Role updated to ${newRole}`);
      setUsers(prev => prev.map(u => (u.id === userId ? { ...u, role: res.data.user.role } : u)));
      fetchStats();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to update role'));
    }
  };

  const handleDelete = async (userId: string) => {
    try {
      await apiClient.delete(`/admin/users/${userId}`);
      toast.success('User deleted');
      setConfirmDelete(null);
      fetchUsers(offset);
      fetchStats();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to delete user'));
    }
  };

  const filteredUsers = users.filter(u =>
    u.email.toLowerCase().includes(search.toLowerCase()) ||
    (u.username || '').toLowerCase().includes(search.toLowerCase())
  );

  const totalPages = Math.ceil(total / LIMIT);
  const currentPage = Math.floor(offset / LIMIT) + 1;

  return (
    <div className="admin-page">
      {/* Header */}
      <header className="admin-header">
        <div className="admin-header-left">
          <div className="admin-logo">⚡</div>
          <div>
            <h1 className="admin-title">Admin Dashboard</h1>
            <p className="admin-subtitle">Manage users, roles &amp; platform access</p>
          </div>
        </div>
        <div className="admin-header-right">
          <span className="role-badge role-badge--admin">ADMIN</span>
          <span className="admin-user-email">{user?.email || 'Loading...'}</span>
          <NotificationBell />
          <Link to="/dashboard" className="btn secondary-btn admin-back-btn">
            ← Back to Dashboard
          </Link>
        </div>
      </header>

      <main className="admin-main">
        {/* Stats Grid */}
        <section className="admin-stats-grid">
          {loadingStats ? (
            Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="admin-stat-card admin-stat-card--skeleton" />
            ))
          ) : stats ? (
            <>
              <StatCard label="Total Users" value={stats.totalUsers} icon="👥" color="indigo" />
              <StatCard label="Admins" value={stats.totalAdmins} icon="🛡️" color="amber" />
              <StatCard label="Moderators" value={stats.totalModerators} icon="🔑" color="purple" />
              <StatCard label="Wallets Linked" value={stats.walletLinked} icon="🔗" color="emerald" />
              <StatCard label="Regular Users" value={stats.regularUsers} icon="👤" color="sky" />
            </>
          ) : null}
        </section>

        {/* Basic Analytics */}
        <section className="admin-table-section">
          <div className="admin-table-header">
            <h2 className="admin-section-title">Analytics — Last {analytics?.days ?? 14} Days</h2>
          </div>

          {loadingAnalytics ? (
            <div className="admin-loading">
              <div className="spinner" />
              <p>Loading analytics…</p>
            </div>
          ) : analytics ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1.5rem' }}>
              <div className="admin-stat-card" style={{ display: 'block', padding: '1.25rem' }}>
                <p className="admin-stat-label" style={{ marginBottom: '0.75rem' }}>New Signups</p>
                <MiniBarChart data={buildDaySeries(analytics.signups, analytics.days)} color="#d41317" />
              </div>
              <div className="admin-stat-card" style={{ display: 'block', padding: '1.25rem' }}>
                <p className="admin-stat-label" style={{ marginBottom: '0.75rem' }}>Tokens Created</p>
                <MiniBarChart data={buildDaySeries(analytics.tokensCreated, analytics.days)} color="#34d399" />
              </div>
              <div className="admin-stat-card" style={{ display: 'block', padding: '1.25rem' }}>
                <p className="admin-stat-label" style={{ marginBottom: '0.75rem' }}>Transactions</p>
                <MiniBarChart data={buildDaySeries(analytics.transactions, analytics.days)} color="#fbbf24" />
              </div>
              <div className="admin-stat-card" style={{ display: 'block', padding: '1.25rem' }}>
                <p className="admin-stat-label" style={{ marginBottom: '0.75rem' }}>Top Token Creators</p>
                {analytics.topCreators.length === 0 ? (
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No tokens created yet.</p>
                ) : (
                  <ol style={{ margin: 0, paddingLeft: '1.2rem', fontSize: '0.88rem' }}>
                    {analytics.topCreators.map(c => (
                      <li key={c.user_id} style={{ marginBottom: '0.4rem' }}>
                        {c.username || c.email} — <strong>{c.token_count}</strong> token{c.token_count === 1 ? '' : 's'}
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            </div>
          ) : null}
        </section>

        {/* User Management Table */}
        <section className="admin-table-section">
          <div className="admin-table-header">
            <h2 className="admin-section-title">User Management</h2>
            <div className="admin-search-wrap">
              <input
                type="text"
                className="admin-search"
                placeholder="Search by email or username…"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
          </div>

          <div className="admin-table-wrapper">
            {loadingUsers ? (
              <div className="admin-loading">
                <div className="spinner" />
                <p>Loading users…</p>
              </div>
            ) : (
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>User</th>
                    <th>Wallet</th>
                    <th>Role</th>
                    <th>Joined</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="admin-empty">No users found.</td>
                    </tr>
                  ) : (
                    filteredUsers.map(u => (
                      <tr key={u.id} className={u.id === user?.id ? 'admin-table-self' : ''}>
                        <td>
                          <div className="admin-user-cell">
                            <div className="admin-avatar">
                              {(u.username || u.email)[0].toUpperCase()}
                            </div>
                            <div>
                              <p className="admin-user-name">{u.username || '—'}</p>
                              <p className="admin-user-email-sm">{u.email}</p>
                            </div>
                          </div>
                        </td>
                        <td>
                          {u.wallet_address ? (
                            <code className="admin-wallet">
                              {u.wallet_address.slice(0, 6)}…{u.wallet_address.slice(-4)}
                            </code>
                          ) : (
                            <span className="admin-no-wallet">Not linked</span>
                          )}
                        </td>
                        <td>
                          <select
                            className={`admin-role-select role-badge ${ROLE_COLORS[u.role]}`}
                            value={u.role}
                            onChange={e => handleRoleChange(u.id, e.target.value as UserRole)}
                            disabled={u.id === user?.id}
                          >
                            <option value="user">user</option>
                            <option value="moderator">moderator</option>
                            <option value="admin">admin</option>
                          </select>
                        </td>
                        <td className="admin-date">
                          {new Date(u.created_at).toLocaleDateString()}
                        </td>
                        <td>
                          {u.id !== user?.id && (
                            confirmDelete === u.id ? (
                              <div className="admin-confirm-btns">
                                <button
                                  className="btn admin-btn-danger-sm"
                                  onClick={() => handleDelete(u.id)}
                                >
                                  Confirm
                                </button>
                                <button
                                  className="btn admin-btn-cancel-sm"
                                  onClick={() => setConfirmDelete(null)}
                                >
                                  Cancel
                                </button>
                              </div>
                            ) : (
                              <button
                                className="btn admin-btn-danger-sm"
                                onClick={() => setConfirmDelete(u.id)}
                              >
                                Delete
                              </button>
                            )
                          )}
                          {u.id === user?.id && (
                            <span className="admin-self-tag">You</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            )}
          </div>

          {/* Pagination */}
          {!search && totalPages > 1 && (
            <div className="admin-pagination">
              <button
                className="btn secondary-btn admin-page-btn"
                disabled={offset === 0}
                onClick={() => {
                  const newOffset = Math.max(0, offset - LIMIT);
                  setOffset(newOffset);
                  fetchUsers(newOffset);
                }}
              >
                ← Prev
              </button>
              <span className="admin-page-info">
                Page {currentPage} of {totalPages}
              </span>
              <button
                className="btn secondary-btn admin-page-btn"
                disabled={offset + LIMIT >= total}
                onClick={() => {
                  const newOffset = offset + LIMIT;
                  setOffset(newOffset);
                  fetchUsers(newOffset);
                }}
              >
                Next →
              </button>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

function StatCard({ label, value, icon, color }: { label: string; value: number; icon: string; color: string }) {
  return (
    <div className={`admin-stat-card admin-stat-card--${color}`}>
      <span className="admin-stat-icon">{icon}</span>
      <div className="admin-stat-body">
        <p className="admin-stat-label">{label}</p>
        <p className="admin-stat-value">{value.toLocaleString()}</p>
      </div>
    </div>
  );
}
