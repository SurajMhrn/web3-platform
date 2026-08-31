import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import toast from 'react-hot-toast';
import { useAuth } from '../contexts/AuthContext';
import { apiClient, getErrorMessage } from '../services/apiClient';

const schema = z.object({
  email: z.string().email({ message: 'Invalid email address' }),
  password: z.string().min(1, { message: 'Password is required' })
});

type FormData = z.infer<typeof schema>;

export function LoginPage() {
  const navigate = useNavigate();
  const { isAuthenticated, setUser } = useAuth();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/dashboard');
    }
  }, [isAuthenticated, navigate]);

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema)
  });

  const onSubmit = async (data: FormData) => {
    try {
      setLoading(true);
      const res = await apiClient.post('/auth/login', {
        email: data.email,
        password: data.password
      });

      setUser(res.data.user);
      toast.success('Logged in successfully!');

      if (!res.data.user.username) {
        navigate('/setup-profile');
      } else {
        navigate('/dashboard');
      }
    } catch (err) {
      toast.error(getErrorMessage(err, 'Login failed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app-container">
      <div className="glass-card">
        <h2 className="title">Welcome Back</h2>
        <p className="subtitle">Sign in to your account.</p>

        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          <div className="input-group">
            <label>Email</label>
            <input type="email" placeholder="you@example.com" {...register('email')} />
            {errors.email && <p className="error-message">{errors.email.message}</p>}
          </div>

          <div className="input-group">
            <label>Password</label>
            <input type="password" placeholder="••••••••" {...register('password')} />
            {errors.password && <p className="error-message">{errors.password.message}</p>}
          </div>

          <button type="submit" className="btn primary-btn" disabled={loading}>
            {loading ? <div className="spinner"></div> : 'Login'}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: '1.5rem' }}>
          <span style={{ color: '#94a3b8' }}>Don't have an account? </span>
          <Link to="/register" className="link-text">Register</Link>
        </div>
      </div>
    </div>
  );
}
