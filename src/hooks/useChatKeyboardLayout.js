import { useCallback, useEffect, useRef } from 'react'
import {
  KEYBOARD_MS,
  claimKeyboardInset,
  measureKeyboardInset,
  onNativeKeyboardHeight,
  publishKeyboardInset,
  resetDocumentScroll,
} from '../utils/keyboardFocus'

/** Keyboard + dock geometry has finished moving by the end of this window. */
export const CHAT_LAYOUT_SETTLE_MS = KEYBOARD_MS + 80

function writeVar(name, px) {
  const root = document.documentElement
  const next = `${px}px`
  if (root.style.getPropertyValue(name) === next) return
  root.style.setProperty(name, next)
}

/**
 * Owns chat room geometry: keyboard inset, composer height, header height.
 *
 * While those numbers change, the message list keeps its distance from the bottom so
 * the conversation rides up with the composer. Finger scroll aborts that follow so the
 * list never fights the user.
 */
export default function useChatKeyboardLayout({ matchId, paneRef, dockRef, ready = true }) {
  const followRafRef = useRef(0)
  const followUntilRef = useRef(0)
  const followingRef = useRef(false)
  const userScrollingRef = useRef(false)
  const scrollBottomRef = useRef(0)
  const geometryRef = useRef({ inset: -1, dock: -1, header: -1 })
  const measuredRef = useRef(false)

  const captureScrollBottom = useCallback(() => {
    const pane = paneRef.current
    if (!pane) return
    scrollBottomRef.current = Math.max(
      0,
      pane.scrollHeight - pane.scrollTop - pane.clientHeight
    )
  }, [paneRef])

  const restoreScrollBottom = useCallback(() => {
    const pane = paneRef.current
    if (!pane) return
    const max = Math.max(0, pane.scrollHeight - pane.clientHeight)
    const next = Math.max(0, Math.min(max, max - scrollBottomRef.current))
    if (Math.abs(pane.scrollTop - next) > 0.5) pane.scrollTop = next
  }, [paneRef])

  const stopFollow = useCallback(() => {
    if (followRafRef.current) {
      cancelAnimationFrame(followRafRef.current)
      followRafRef.current = 0
    }
    followUntilRef.current = 0
    followingRef.current = false
  }, [])

  /**
   * Ride the keyboard animation only — never while the user is dragging the list.
   */
  const startFollow = useCallback(() => {
    if (userScrollingRef.current) return
    followUntilRef.current = performance.now() + CHAT_LAYOUT_SETTLE_MS
    if (followRafRef.current) return

    function step() {
      if (userScrollingRef.current) {
        followRafRef.current = 0
        followingRef.current = false
        return
      }
      followingRef.current = true
      restoreScrollBottom()
      if (performance.now() < followUntilRef.current) {
        followRafRef.current = requestAnimationFrame(step)
        return
      }
      followRafRef.current = 0
      followingRef.current = false
      captureScrollBottom()
    }

    followRafRef.current = requestAnimationFrame(step)
  }, [captureScrollBottom, restoreScrollBottom])

  const applyLayout = useCallback(() => {
    const inset = measureKeyboardInset()
    const dock = dockRef.current
    const dockHeight = dock ? Math.ceil(dock.getBoundingClientRect().height) : 0
    const header = matchId
      ? document.querySelector(
          `[data-chat-room-portal][data-chat-id="${CSS.escape(matchId)}"] .chat-room-header-pinned`
        )
      : null
    const headerHeight = header ? Math.ceil(header.getBoundingClientRect().height) : 0

    const prev = geometryRef.current
    const moved =
      (dockHeight > 0 && prev.dock !== dockHeight) ||
      (headerHeight > 0 && prev.header !== headerHeight) ||
      prev.inset !== inset
    // First pass only records the chrome sizes; there is no scroll offset worth
    // preserving yet, and following one would fight the open-at-bottom jump.
    const settled = measuredRef.current

    if (moved && settled && !followingRef.current && !userScrollingRef.current) {
      captureScrollBottom()
    }

    geometryRef.current = {
      inset,
      dock: dockHeight > 0 ? dockHeight : prev.dock,
      header: headerHeight > 0 ? headerHeight : prev.header,
    }
    if (dockHeight > 0 && headerHeight > 0) measuredRef.current = true

    if (dockHeight > 0) writeVar('--chat-room-composer-height', dockHeight)
    if (headerHeight > 0) writeVar('--chat-room-header-height', headerHeight)
    publishKeyboardInset(inset)
    resetDocumentScroll()

    if (moved && settled && !userScrollingRef.current) startFollow()
  }, [captureScrollBottom, dockRef, matchId, startFollow])

  useEffect(() => {
    if (!ready) return undefined

    const release = claimKeyboardInset()
    const root = document.documentElement

    let scheduled = 0
    const schedule = () => {
      if (scheduled) return
      scheduled = requestAnimationFrame(() => {
        scheduled = 0
        applyLayout()
      })
    }

    applyLayout()

    const pane = paneRef.current
    let scrollIdleTimer = 0
    const markUserScrolling = () => {
      userScrollingRef.current = true
      stopFollow()
      window.clearTimeout(scrollIdleTimer)
      scrollIdleTimer = window.setTimeout(() => {
        userScrollingRef.current = false
        captureScrollBottom()
      }, 120)
    }

    const onPanePointerDown = () => {
      userScrollingRef.current = true
      stopFollow()
    }
    const onPanePointerUp = () => {
      window.clearTimeout(scrollIdleTimer)
      scrollIdleTimer = window.setTimeout(() => {
        userScrollingRef.current = false
        captureScrollBottom()
      }, 120)
    }
    const onPaneScroll = () => {
      if (followingRef.current) return
      markUserScrolling()
      captureScrollBottom()
    }

    pane?.addEventListener('pointerdown', onPanePointerDown, { passive: true })
    pane?.addEventListener('pointerup', onPanePointerUp, { passive: true })
    pane?.addEventListener('pointercancel', onPanePointerUp, { passive: true })
    pane?.addEventListener('scroll', onPaneScroll, { passive: true })

    const observer = new ResizeObserver(schedule)
    if (dockRef.current) observer.observe(dockRef.current)
    const header = matchId
      ? document.querySelector(
          `[data-chat-room-portal][data-chat-id="${CSS.escape(matchId)}"] .chat-room-header-pinned`
        )
      : null
    if (header) observer.observe(header)

    const unsubscribeNative = onNativeKeyboardHeight(applyLayout)
    const vv = window.visualViewport
    // resize only — vv scroll fires constantly during overscroll and was restarting follow.
    vv?.addEventListener('resize', schedule)
    window.addEventListener('resize', schedule)
    window.addEventListener('orientationchange', schedule)

    return () => {
      release()
      observer.disconnect()
      unsubscribeNative()
      window.clearTimeout(scrollIdleTimer)
      pane?.removeEventListener('pointerdown', onPanePointerDown)
      pane?.removeEventListener('pointerup', onPanePointerUp)
      pane?.removeEventListener('pointercancel', onPanePointerUp)
      pane?.removeEventListener('scroll', onPaneScroll)
      vv?.removeEventListener('resize', schedule)
      window.removeEventListener('resize', schedule)
      window.removeEventListener('orientationchange', schedule)
      if (scheduled) cancelAnimationFrame(scheduled)
      stopFollow()
      geometryRef.current = { inset: -1, dock: -1, header: -1 }
      measuredRef.current = false
      root.style.removeProperty('--chat-room-composer-height')
      root.style.removeProperty('--chat-room-header-height')
      publishKeyboardInset(0)
    }
  }, [applyLayout, captureScrollBottom, dockRef, matchId, paneRef, ready, stopFollow])
}
