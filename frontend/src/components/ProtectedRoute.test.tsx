import { describe, it, expect, vi } from 'vitest';
import type { ReactElement } from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { ProtectedRoute, AdminRoute } from './ProtectedRoute';
import { useAuth } from '../contexts/AuthContext';

vi.mock('../contexts/AuthContext', () => ({
  useAuth: vi.fn(),
}));

const mockUseAuth = vi.mocked(useAuth);

function renderAt(path: string, element: ReactElement) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/login" element={<div>Login Page</div>} />
        <Route path="/dashboard" element={<div>Dashboard Page</div>} />
        <Route path="/protected" element={element} />
      </Routes>
    </MemoryRouter>
  );
}

describe('ProtectedRoute', () => {
  it('redirects to /login when not authenticated', () => {
    mockUseAuth.mockReturnValue({ isAuthenticated: false } as ReturnType<typeof useAuth>);

    renderAt('/protected', (
      <ProtectedRoute>
        <div>Secret Content</div>
      </ProtectedRoute>
    ));

    expect(screen.getByText('Login Page')).toBeInTheDocument();
    expect(screen.queryByText('Secret Content')).not.toBeInTheDocument();
  });

  it('renders children when authenticated', () => {
    mockUseAuth.mockReturnValue({ isAuthenticated: true } as ReturnType<typeof useAuth>);

    renderAt('/protected', (
      <ProtectedRoute>
        <div>Secret Content</div>
      </ProtectedRoute>
    ));

    expect(screen.getByText('Secret Content')).toBeInTheDocument();
  });
});

describe('AdminRoute', () => {
  it('redirects to /dashboard when the user is not an admin', () => {
    mockUseAuth.mockReturnValue({ isAdmin: false } as ReturnType<typeof useAuth>);

    renderAt('/protected', (
      <AdminRoute>
        <div>Admin Content</div>
      </AdminRoute>
    ));

    expect(screen.getByText('Dashboard Page')).toBeInTheDocument();
    expect(screen.queryByText('Admin Content')).not.toBeInTheDocument();
  });

  it('renders children when the user is an admin', () => {
    mockUseAuth.mockReturnValue({ isAdmin: true } as ReturnType<typeof useAuth>);

    renderAt('/protected', (
      <AdminRoute>
        <div>Admin Content</div>
      </AdminRoute>
    ));

    expect(screen.getByText('Admin Content')).toBeInTheDocument();
  });
});
