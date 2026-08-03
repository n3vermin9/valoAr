import { Capacitor } from '@capacitor/core'

/**
 * Native shell boot. Accessory bar (↑↓ Done) is hidden in iOS via
 * KeyboardAccessoryHider.swift — no @capacitor/keyboard SPM product needed.
 */
export async function setupNativeShell() {
  if (!Capacitor.isNativePlatform()) return
  // Reserved for future native-only setup (status bar, splash, etc.).
}
