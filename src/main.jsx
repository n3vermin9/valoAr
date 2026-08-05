import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { AuthProvider } from './contexts/AuthContext'
import App from './App'
import './index.css'
import { setupInteractionGuards } from './utils/interactionGuards'
import { setupNativeShell } from './native/setupNativeShell'
import { setupSafeAreaInsets } from './native/setupSafeAreaInsets'
import { setupKeyboardFocusScroll, setupKeyboardInset } from './utils/keyboardFocus'
import { AppKeyboardProvider } from './components/ui/AppKeyboard'
import { getCachedAppleEmojiDataUrl, preloadMainEmojis } from './services/emojiImageCache'
import { setAppleEmojiLocalResolver } from './utils/iosEmoji'
import { bootAppearance } from './utils/appearance'

setAppleEmojiLocalResolver(getCachedAppleEmojiDataUrl)
bootAppearance()
setupInteractionGuards()
setupSafeAreaInsets()
setupKeyboardFocusScroll()
setupKeyboardInset()
void setupNativeShell()
void preloadMainEmojis()

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
