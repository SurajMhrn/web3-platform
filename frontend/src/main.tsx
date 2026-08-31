import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { Web3ModalProvider } from './providers/Web3Provider'
import { AuthProvider } from './contexts/AuthContext'
import { GlobalErrorBoundary } from './GlobalErrorBoundary'

createRoot(document.getElementById('root')!).render(
  <GlobalErrorBoundary>
    <Web3ModalProvider>
      <AuthProvider>
        <App />
      </AuthProvider>
    </Web3ModalProvider>
  </GlobalErrorBoundary>,
)
