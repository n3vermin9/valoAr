import { useEffect, useState } from 'react'
import {
  onNativeKeyboardHeight,
  onAppKeyboardInset,
  measureKeyboardInset,
  KEYBOARD_EASE,
  KEYBOARD_MS,
} from '../utils/keyboardFocus'

/**
 * Keyboard inset for fixed overlays (story composer). Same measurement the chat room
 * uses, so overlays and chat never disagree about where the keyboard is.
 */
export function useOverlayKeyboardInset(active) {
  const [inset, setInset] = useState(0)
  const [keyboardOpen, setKeyboardOpen] = useState(false)

  useEffect(() => {
    // Going inactive is handled by the previous run's cleanup.
    if (!active) return undefined

    const resolve = () => {
      const nextInset = measureKeyboardInset()
      const nextOpen = nextInset > 0
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
