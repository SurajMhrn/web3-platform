import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import toast from 'react-hot-toast';
import { useAuth } from '../contexts/AuthContext';
import { apiClient, getErrorMessage } from '../services/apiClient';

const schema = z.object({
  username: z.string().min(3, { message: 'Username must be at least 3 characters' }),
  bio: z.string().optional(),
  profilePicture: z.string().url({ message: 'Must be a valid URL' }).or(z.literal(''))
});

type FormData = z.infer<typeof schema>;

export function SetupProfilePage() {
  const navigate = useNavigate();
  const { isAuthenticated, user, setUser } = useAuth();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
    }
  }, [isAuthenticated, navigate]);

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      username: user?.username || '',
      bio: user?.bio || '',
      profilePicture: user?.profile_picture || ''
    }
  });

  const onSubmit = async (data: FormData) => {
    try {
      setLoading(true);
      const res = await apiClient.post('/auth/setup-profile', data);

      setUser(res.data.user);
      toast.success('Profile setup successful!');
      navigate('/dashboard');
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to update profile'));
    } finally {
      setLoading(false);
    }
  };

  if (!isAuthenticated) return null;

  return (
    <div className="app-container">
      <div className="glass-card">
        <h2 className="title">Setup Profile</h2>
        <p className="subtitle">Tell us a bit about yourself.</p>

        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          <div className="input-group">
            <label>Username</label>
            <input type="text" placeholder="CoolUser99" {...register('username')} />
            {errors.username && <p className="error-message">{errors.username.message}</p>}
          </div>

          <div className="input-group">
            <label>Bio (Short Description)</label>
            <textarea placeholder="I love web3 and real estate!" rows={3} {...register('bio')} />
            {errors.bio && <p className="error-message">{errors.bio.message}</p>}
          </div>

          <div className="input-group">
            <label>Profile Picture URL</label>
            <input type="text" placeholder="https://example.com/pic.png" {...register('profilePicture')} />
            {errors.profilePicture && <p className="error-message">{errors.profilePicture.message}</p>}
          </div>

          <button type="submit" className="btn primary-btn" disabled={loading}>
            {loading ? <div className="spinner"></div> : 'Save Profile'}
          </button>
        </form>
      </div>
    </div>
  );
}
