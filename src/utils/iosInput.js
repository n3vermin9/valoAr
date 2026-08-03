import { Capacitor } from '@capacitor/core'

/** Coarse pointer / iOS / Android — treat as mobile for input UX. */
export function isMobileInputDevice() {
  if (typeof navigator === 'undefined') return false
  if (Capacitor.isNativePlatform()) return true

  const ua = navigator.userAgent || ''
  const iOS =
    /iPhone|iPad|iPod/i.test(ua) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  if (iOS) return true
  if (/Android/i.test(ua)) return true
  if (typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches) {
    return true
  }
  return false
}

/**
 * In-app keyboard was a Safari accessory-bar workaround. Prefer the system
 * keyboard everywhere (including iOS Safari / Capacitor).
 */
export function shouldUseAppKeyboard() {
  return false
}

/** Autofocus on page load steals focus and fights the system keyboard on mobile. */
export function allowAutofocus() {
  return !isMobileInputDevice()
}
