import { useEffect, useRef, useState } from 'react'
import {
  getNativeKeyboardHeight,
  onNativeKeyboardHeight,
  getAppKeyboardInset,
  onAppKeyboardInset,
  KEYBOARD_EASE,
  KEYBOARD_MS,
} from '../utils/keyboardFocus'

function readVisualGap() {
  const vv = window.visualViewport
  if (!vv) return 0
  const gap = window.innerHeight - vv.height - Math.max(0, vv.offsetTop)
  return gap >= 48 ? Math.round(gap) : 0
}

/**
 * Keyboard inset for fixed overlays (story composer).
 *
 * Chat keeps --app-keyboard-inset at 0 when resize:native shrinks the webview.
 * Overlays still need padding when that resize is delayed (common until a swipe
 * updates visualViewport). If the webview already shrank, skip padding.
 */
export function useOverlayKeyboardInset(active) {
  const [inset, setInset] = useState(0)
  const [keyboardOpen, setKeyboardOpen] = useState(false)
  const baselineHeightRef = useRef(0)

  useEffect(() => {
    if (!active) {
      setInset(0)
      setKeyboardOpen(false)
      return undefined
    }

    baselineHeightRef.current = window.innerHeight

    const resolve = () => {
      const native = getNativeKeyboardHeight()
      const visual = readVisualGap()
      const fromVar = getAppKeyboardInset()

      if (native <= 0 && visual <= 0 && fromVar <= 0) {
        baselineHeightRef.current = Math.max(baselineHeightRef.current, window.innerHeight)
        setInset(0)
        setKeyboardOpen(false)
        return
      }

      // Webview already consumed the keyboard (resize:native) → don't pad again.
      const shrunkBy = Math.max(0, baselineHeightRef.current - window.innerHeight)
      const webviewHandled = native > 0 && shrunkBy >= native * 0.45

      let nextInset = 0
      if (webviewHandled) {
        nextInset = 0
      } else if (native > 0) {
        // Prefer Cap height so we don't wait for a swipe to refresh VV.
        nextInset = native
      } else {
        nextInset = Math.max(visual, fromVar)
      }

      const nextOpen = nextInset >= 48 || native > 0 || webviewHandled
      setInset((prev) => (prev === nextInset ? prev : nextInset))
      setKeyboardOpen((prev) => (prev === nextOpen ? prev : nextOpen))
    }

    resolve()

    const unsubNative = onNativeKeyboardHeight(resolve)
    const unsubInset = onAppKeyboardInset(resolve)
    const vv = window.visualViewport
    vv?.addEventListener('resize', resolve)
    vv?.addEventListener('scroll', resolve)
    window.addEventListener('resize', resolve)
    window.addEventListener('focusin', resolve)

    return () => {
      unsubNative()
      unsubInset()
      vv?.removeEventListener('resize', resolve)
      vv?.removeEventListener('scroll', resolve)
      window.removeEventListener('resize', resolve)
      window.removeEventListener('focusin', resolve)
      setInset(0)
      setKeyboardOpen(false)
    }
  }, [active])

  return { inset, keyboardOpen, ease: KEYBOARD_EASE, ms: KEYBOARD_MS }
}
