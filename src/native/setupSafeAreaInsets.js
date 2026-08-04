import { Capacitor } from '@capacitor/core'

function readEnvInset(side) {
  if (typeof document === 'undefined') return 0
  const probe = document.createElement('div')
  probe.style.cssText = `
    position: fixed;
    visibility: hidden;
    pointer-events: none;
    padding-${side}: env(safe-area-inset-${side}, 0px);
  `
  document.documentElement.appendChild(probe)
  const value = parseFloat(getComputedStyle(probe).getPropertyValue(`padding-${side}`)) || 0
  probe.remove()
  return value
}

function readNativeVar(name) {
  if (typeof document === 'undefined') return 0
  return parseFloat(getComputedStyle(document.documentElement).getPropertyValue(name)) || 0
}

/** Fallback when WKWebView leaves env(safe-area-inset-*) at 0. */
function estimateIosSafeTop() {
  const shortest = Math.min(window.screen.width, window.screen.height)
  const tallest = Math.max(window.screen.width, window.screen.height)
  // Modern iPhones (X+) in points.
  if (tallest >= 852 && shortest >= 390) return 59 // Dynamic Island
  if (tallest >= 812) return 50 // Notch
  return 20
}

function estimateIosSafeBottom() {
  const tallest = Math.max(window.screen.width, window.screen.height)
  return tallest >= 812 ? 34 : 0
}

function applyInset(name, px) {
  if (px <= 0) return
  document.documentElement.style.setProperty(name, `${Math.round(px)}px`)
}

/**
 * Ensure --native-safe-* is set on Capacitor when CSS env() is stuck at 0.
 * Native AppBridgeViewController usually wins; this covers races / live reload.
 */
export function setupSafeAreaInsets() {
  if (!Capacitor.isNativePlatform()) return () => {}

  const sync = () => {
    const envTop = readEnvInset('top')
    const envBottom = readEnvInset('bottom')
    const envLeft = readEnvInset('left')
    const envRight = readEnvInset('right')

    const nativeTop = readNativeVar('--native-safe-top')
    const nativeBottom = readNativeVar('--native-safe-bottom')

    if (envTop < 20 && nativeTop < 20) {
      applyInset('--native-safe-top', estimateIosSafeTop())
    }
    if (envBottom < 10 && nativeBottom < 10) {
      applyInset('--native-safe-bottom', estimateIosSafeBottom())
    }
    if (envLeft > 0) applyInset('--native-safe-left', envLeft)
    if (envRight > 0) applyInset('--native-safe-right', envRight)
  }

  sync()
  const onResize = () => sync()
  window.addEventListener('resize', onResize)
  window.visualViewport?.addEventListener('resize', onResize)
  document.addEventListener('visibilitychange', sync)

  // WebKit sometimes populates env() only after the first layout pass.
  const t1 = window.setTimeout(sync, 50)
  const t2 = window.setTimeout(sync, 300)

  return () => {
    window.clearTimeout(t1)
    window.clearTimeout(t2)
    window.removeEventListener('resize', onResize)
    window.visualViewport?.removeEventListener('resize', onResize)
    document.removeEventListener('visibilitychange', sync)
  }
}
