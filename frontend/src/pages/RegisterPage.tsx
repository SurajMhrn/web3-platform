import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import toast from 'react-hot-toast';
import { useAuth } from '../contexts/AuthContext';
import { apiClient, getErrorMessage } from '../services/apiClient';

const schema = z.object({
  email: z.string().email({ message: 'Invalid email address' }),
  password: z.string().min(8, { message: 'Password must be at least 8 characters' }),
  confirmPassword: z.string()
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"]
});

type FormData = z.infer<typeof schema>;

export function RegisterPage() {
  const navigate = useNavigate();
  const { setUser } = useAuth();
  const [loading, setLoading] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema)
  });

  const onSubmit = async (data: FormData) => {
    try {
      setLoading(true);
      const res = await apiClient.post('/auth/register', {
        email: data.email,
        password: data.password
      });

      setUser(res.data.user);
      toast.success('Registration successful!');
      navigate('/setup-profile');
    } catch (err) {
      toast.error(getErrorMessage(err, 'Registration failed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app-container">
      <div className="glass-card">
        <h2 className="title">Create Account</h2>
        <p className="subtitle">Join our platform today.</p>

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

          <div className="input-group">
            <label>Confirm Password</label>
            <input type="password" placeholder="••••••••" {...register('confirmPassword')} />
            {errors.confirmPassword && <p className="error-message">{errors.confirmPassword.message}</p>}
          </div>

          <button type="submit" className="btn primary-btn" disabled={loading}>
            {loading ? <div className="spinner"></div> : 'Register'}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: '1.5rem' }}>
          <span style={{ color: '#94a3b8' }}>Already have an account? </span>
          <Link to="/login" className="link-text">Log in</Link>
        </div>
      </div>
    </div>
  );
}
