import { useNavigate } from 'react-router-dom';

export function WelcomePage() {
  const navigate = useNavigate();

  return (
    <div className="app-container">
      <div className="glass-card text-center">
        <h1 className="title">Web3 Platform</h1>
        <p className="subtitle">Real Estate Tokenization MVP - Phase 1</p>
        
        <div className="auth-container" style={{ display: 'flex', gap: '1rem', justifyContent: 'center', marginTop: '2rem' }}>
          <button className="btn primary-btn" onClick={() => navigate('/login')}>
            Login
          </button>
          <button className="btn secondary-btn" onClick={() => navigate('/register')} style={{
            background: 'rgba(255, 255, 255, 0.1)',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            padding: '12px 24px',
            borderRadius: '8px',
            color: 'white',
            cursor: 'pointer',
            transition: 'all 0.3s ease'
          }}>
            Registration
          </button>
        </div>
      </div>
    </div>
  );
}
