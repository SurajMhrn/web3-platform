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
          <button className="btn secondary-btn" onClick={() => navigate('/register')}>
            Registration
          </button>
        </div>
      </div>
    </div>
  );
}
