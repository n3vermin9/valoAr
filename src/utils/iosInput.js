import { Capacitor } from '@capacitor/core'

/** True on iOS Safari / home-screen PWA where the system ↑↓ Done bar cannot be hidden. */
export function shouldUseAppKeyboard() {
  if (typeof navigator === 'undefined') return false
  // Capacitor WKWebView can hide the accessory bar — keep the system keyboard.
  if (Capacitor.isNativePlatform()) return false

  const ua = navigator.userAgent || ''
  const iOS =
    /iPhone|iPad|iPod/i.test(ua) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  return iOS
}
