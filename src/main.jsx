import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { AuthProvider } from './contexts/AuthContext'
import App from './App'
import './index.css'
import { setupInteractionGuards } from './utils/interactionGuards'

setupInteractionGuards()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
        <Toaster
          position="bottom-center"
          containerStyle={{ bottom: 96 }}
          gutter={10}
          toastOptions={{
            duration: 2000,
            className: 'toast-glass',
            style: {
              maxWidth: 'min(90vw, 360px)',
            },
            success: { icon: null },
            error: { icon: null },
          }}
        />
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>
)
