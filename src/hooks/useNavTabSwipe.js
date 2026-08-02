import { useEffect, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { subscribeMapModeOverlayOpen } from '../utils/mapModeOverlay'
import { subscribeModalOverlayOpen } from '../utils/modalOverlay'
import { subscribeStoryComposerOpen } from '../utils/storyOverlay'
import { subscribeProfileEditorOpen } from '../utils/profileOverlay'

export const NAV_TAB_PATHS = ['/discover', '/chats', '/liked', '/profile']

const TOUCH_THRESHOLD_PX = 56
const TOUCH_AXIS_RATIO = 1.15
const WHEEL_THRESHOLD_PX = 90
const WHEEL_RESET_MS = 180
const WHEEL_COOLDOWN_MS = 420

export function getNavTabIndex(pathname) {
  if (pathname.startsWith('/chats/') && pathname !== '/chats') return null
  if (pathname.startsWith('/groups/')) return null
  if (pathname.startsWith('/debug')) return null

  const index = NAV_TAB_PATHS.findIndex((path) =>
    path === '/discover' ? pathname === path : pathname.startsWith(path)
  )
  return index >= 0 ? index : null
}

function isBlockedTarget(target) {
  if (!(target instanceof Element)) return false
  return Boolean(
    target.closest(
      'input, textarea, select, [contenteditable="true"], [data-story-viewer], .leaflet-container, .discover-map-container'
    )
  )
}

/**
 * Swipe / trackpad horizontal navigation between main bottom-nav tabs.
 */
export default function useNavTabSwipe() {
  const navigate = useNavigate()
  const location = useLocation()
  const pathnameRef = useRef(location.pathname)
  const overlayBlockedRef = useRef(false)
  const wheelAccRef = useRef(0)
  const wheelTimerRef = useRef(0)
  const wheelCooldownRef = useRef(0)
  const touchRef = useRef(null)

  pathnameRef.current = location.pathname

  useEffect(() => {
    let mapOpen = false
    let modalOpen = false
    let storyComposerOpen = false
    let profileEditorOpen = false
    const update = () => {
      overlayBlockedRef.current =
        mapOpen || modalOpen || storyComposerOpen || profileEditorOpen
    }
    const unsubMap = subscribeMapModeOverlayOpen((open) => {
      mapOpen = open
      update()
    })
    const unsubModal = subscribeModalOverlayOpen((open) => {
      modalOpen = open
      update()
    })
    const unsubStory = subscribeStoryComposerOpen((open) => {
      storyComposerOpen = open
      update()
    })
    const unsubProfile = subscribeProfileEditorOpen((open) => {
      profileEditorOpen = open
      update()
    })
    return () => {
      unsubMap()
      unsubModal()
      unsubStory()
      unsubProfile()
    }
  }, [])

  useEffect(() => {
    const go = (direction) => {
      if (overlayBlockedRef.current) return false
      if (document.querySelector('[data-story-viewer]')) return false

      const index = getNavTabIndex(pathnameRef.current)
      if (index == null) return false

      const next = index + direction
      if (next < 0 || next >= NAV_TAB_PATHS.length) return false

      navigate(NAV_TAB_PATHS[next])
      return true
    }

    const onTouchStart = (e) => {
      if (overlayBlockedRef.current) return
      if (e.touches.length !== 1) return
      if (isBlockedTarget(e.target)) return
      if (getNavTabIndex(pathnameRef.current) == null) return

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

      // Once the gesture is clearly horizontal, stop the page from scrolling with it.
      if (
        start.maxDx >= 24 &&
        start.maxDx > start.maxDy * TOUCH_AXIS_RATIO &&
        e.cancelable
      ) {
        e.preventDefault()
      }
    }

    const finishTouch = (e) => {
      const start = touchRef.current
      touchRef.current = null
      if (!start) return
      if (overlayBlockedRef.current) return
      if (getNavTabIndex(pathnameRef.current) == null) return

      const t = e.changedTouches?.[0]
      if (!t) return

      const dx = t.clientX - start.x
      const dy = t.clientY - start.y
      const absX = Math.abs(dx)
      const absY = Math.abs(dy)

      // Decide from the full gesture — early vertical jitter must not kill a real swipe.
      if (absX < TOUCH_THRESHOLD_PX) return
      if (absX < absY * TOUCH_AXIS_RATIO) return

      go(dx < 0 ? 1 : -1)
    }

    const onTouchCancel = () => {
      touchRef.current = null
    }

    const onWheel = (e) => {
      if (overlayBlockedRef.current) return
      if (isBlockedTarget(e.target)) return
      if (getNavTabIndex(pathnameRef.current) == null) return

      const absX = Math.abs(e.deltaX)
      const absY = Math.abs(e.deltaY)
      if (absX < 4 || absX < absY * TOUCH_AXIS_RATIO) {
        wheelAccRef.current = 0
        return
      }

      const now = performance.now()
      if (now < wheelCooldownRef.current) return

      wheelAccRef.current += e.deltaX
      window.clearTimeout(wheelTimerRef.current)
      wheelTimerRef.current = window.setTimeout(() => {
        wheelAccRef.current = 0
      }, WHEEL_RESET_MS)

      if (Math.abs(wheelAccRef.current) < WHEEL_THRESHOLD_PX) return

      const direction = wheelAccRef.current > 0 ? 1 : -1
      wheelAccRef.current = 0
      if (go(direction)) {
        wheelCooldownRef.current = now + WHEEL_COOLDOWN_MS
        if (e.cancelable) e.preventDefault()
      }
    }

    // Bubble phase on touchend so child controls still get clicks; capture on move for preventDefault.
    document.addEventListener('touchstart', onTouchStart, { passive: true, capture: true })
    document.addEventListener('touchmove', onTouchMove, { passive: false, capture: true })
    document.addEventListener('touchend', finishTouch, { passive: true, capture: true })
    document.addEventListener('touchcancel', onTouchCancel, { passive: true, capture: true })
    document.addEventListener('wheel', onWheel, { passive: false, capture: true })

    return () => {
      document.removeEventListener('touchstart', onTouchStart, true)
      document.removeEventListener('touchmove', onTouchMove, true)
      document.removeEventListener('touchend', finishTouch, true)
      document.removeEventListener('touchcancel', onTouchCancel, true)
      document.removeEventListener('wheel', onWheel, true)
      window.clearTimeout(wheelTimerRef.current)
    }
  }, [navigate])
}
