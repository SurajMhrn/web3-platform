import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { Web3ModalProvider } from './providers/Web3Provider'
import { AuthProvider } from './contexts/AuthContext'
import { ThemeProvider } from './contexts/ThemeContext'
import { GlobalErrorBoundary } from './GlobalErrorBoundary'

createRoot(document.getElementById('root')!).render(
  <GlobalErrorBoundary>
    <ThemeProvider>
      <Web3ModalProvider>
        <AuthProvider>
          <App />
        </AuthProvider>
      </Web3ModalProvider>
    </ThemeProvider>
  </GlobalErrorBoundary>,
)
