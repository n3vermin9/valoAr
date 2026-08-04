import { useEffect, useRef } from 'react'

/** Finger must move at least this far right to close. */
const THRESHOLD_PX = 56
const AXIS_RATIO = 1.1

function isBlockedTarget(target) {
  if (!(target instanceof Element)) return false
  return Boolean(
    target.closest(
      [
        'input',
        'textarea',
        'select',
        '[contenteditable="true"]',
        '[data-story-viewer]',
        '[data-chat-composer="true"]',
        // Swipe-to-reply on incoming bubbles is also rightward — leave those alone.
        '.message-bubble',
      ].join(', ')
    )
  )
}

/**
 * Swipe right (finger moves right) on the chat to go back to the chat list.
 * Ignored on message bubbles / composer so reply gestures stay intact.
 */
export default function useChatBackSwipe(enabled, onBack) {
  const onBackRef = useRef(onBack)
  onBackRef.current = onBack
  const touchRef = useRef(null)

  useEffect(() => {
    if (!enabled) return undefined

    const onTouchStart = (e) => {
      if (e.touches.length !== 1) return
      if (isBlockedTarget(e.target)) return
      if (!document.documentElement.classList.contains('chat-room-active')) return

      const t = e.touches[0]
      touchRef.current = {
        x: t.clientX,
        y: t.clientY,
        maxDx: 0,
        maxDy: 0,
      }
    }

    const onTouchMove = (e) => {
      const start = touchRef.current
      if (!start || e.touches.length !== 1) return

      const t = e.touches[0]
      const dx = t.clientX - start.x
      const dy = t.clientY - start.y
      start.maxDx = Math.max(start.maxDx, Math.abs(dx))
      start.maxDy = Math.max(start.maxDy, Math.abs(dy))

      if (dx > 12 && start.maxDx > start.maxDy * AXIS_RATIO && e.cancelable) {
        e.preventDefault()
      }
    }

    const finishTouch = (e) => {
      const start = touchRef.current
      touchRef.current = null
      if (!start) return
      if (!document.documentElement.classList.contains('chat-room-active')) return

      const t = e.changedTouches?.[0]
      if (!t) return

      const dx = t.clientX - start.x
      const dy = t.clientY - start.y
      if (dx < THRESHOLD_PX) return
      if (Math.abs(dx) < Math.abs(dy) * AXIS_RATIO) return

      onBackRef.current?.()
    }

    const onTouchCancel = () => {
      touchRef.current = null
    }

    document.addEventListener('touchstart', onTouchStart, { passive: true, capture: true })
    document.addEventListener('touchmove', onTouchMove, { passive: false, capture: true })
    document.addEventListener('touchend', finishTouch, { passive: true, capture: true })
    document.addEventListener('touchcancel', onTouchCancel, { passive: true, capture: true })

    return () => {
      document.removeEventListener('touchstart', onTouchStart, true)
      document.removeEventListener('touchmove', onTouchMove, true)
      document.removeEventListener('touchend', finishTouch, true)
      document.removeEventListener('touchcancel', onTouchCancel, true)
      touchRef.current = null
    }
  }, [enabled])
}
