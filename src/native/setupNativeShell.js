import { Capacitor } from '@capacitor/core'
import { Keyboard } from '@capacitor/keyboard'
import { attachNativeKeyboardListeners } from '../utils/keyboardFocus'

/**
 * Native shell boot. Accessory bar (↑↓ Done) is hidden by @capacitor/keyboard
 * (hideFormAccessoryBar defaults to YES). We also pin it from JS.
 */
export async function setupNativeShell() {
  if (!Capacitor.isNativePlatform()) return

  try {
    await Keyboard.setAccessoryBarVisible({ isVisible: false })
    // Stop WKWebView from panning the whole page when the keyboard opens
    // (keeps chat header / top content glued in place).
    await Keyboard.setScroll({ isDisabled: true })
    // Register height listeners after the bridge is up so chat can lift.
    await attachNativeKeyboardListeners()
  } catch {
    // Plugin missing / web — ignore.
  }
}
