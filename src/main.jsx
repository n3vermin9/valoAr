import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { AuthProvider } from './contexts/AuthContext'
import App from './App'
import './index.css'
import { setupInteractionGuards } from './utils/interactionGuards'
import { setupNativeShell } from './native/setupNativeShell'
import { setupKeyboardFocusScroll } from './utils/keyboardFocus'
import { AppKeyboardProvider } from './components/ui/AppKeyboard'

setupInteractionGuards()
setupKeyboardFocusScroll()
void setupNativeShell()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <AppKeyboardProvider>
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
        </AppKeyboardProvider>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>
)
