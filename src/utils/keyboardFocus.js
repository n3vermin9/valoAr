import { Capacitor } from '@capacitor/core'
import { Keyboard } from '@capacitor/keyboard'

const FOCUSABLE =
  'input:not([type="hidden"]):not([disabled]), textarea:not([disabled]), select:not([disabled]), [contenteditable="true"]'

const KEYBOARD_INSET_EVENT = 'app-keyboard-inset'
/** Match iOS keyboard animation (~250ms). */
const KEYBOARD_EASE = 'cubic-bezier(0.32, 0.72, 0, 1)'
const KEYBOARD_MS = 280

let currentInset = 0
let nativeHeight = 0
let viewportHeight = 0
let nativeListenersReady = false
let rafId = 0
let pinRafId = 0
let pinActive = false
let lastPinY = -1
let pinSettleUntil = 0

function readChatHeaderPinY() {
  if (!pinActive || currentInset <= 0) return 0
  const vv = window.visualViewport
  return vv ? Math.max(0, Math.round(vv.offsetTop)) : 0
}

function applyChatHeaderPin() {
  const y = readChatHeaderPinY()
  if (y === lastPinY) return
  lastPinY = y
  document.documentElement.style.setProperty('--chat-header-pin-y', `${y}px`)
}

function scheduleChatHeaderPin() {
  if (pinRafId) return
  pinRafId = requestAnimationFrame(() => {
    pinRafId = 0
    applyChatHeaderPin()
    const keepPolling =
      pinActive && (currentInset > 0 || performance.now() < pinSettleUntil)
    if (keepPolling) scheduleChatHeaderPin()
  })
}

/** Web-only — counter-pans header when the browser shifts visualViewport. */
export function activateChatHeaderPin() {
  if (Capacitor.isNativePlatform()) return () => {}

  pinActive = true
  lastPinY = -1
  scheduleChatHeaderPin()

  const vv = window.visualViewport
  const onViewportChange = () => scheduleChatHeaderPin()
  vv?.addEventListener('scroll', onViewportChange)
  vv?.addEventListener('resize', onViewportChange)

  return () => {
    pinActive = false
    pinSettleUntil = 0
    vv?.removeEventListener('scroll', onViewportChange)
    vv?.removeEventListener('resize', onViewportChange)
    if (pinRafId) cancelAnimationFrame(pinRafId)
    lastPinY = 0
    document.documentElement.style.setProperty('--chat-header-pin-y', '0px')
  }
}

function setAppKeyboardInset(px) {
  const next = Math.max(0, Math.round(px || 0))
  if (next === currentInset) return
  currentInset = next
  const root = document.documentElement
  root.style.setProperty('--app-keyboard-inset', `${next}px`)
  window.dispatchEvent(
    new CustomEvent(KEYBOARD_INSET_EVENT, { detail: { height: next } })
  )
}

function readViewportKeyboardHeight() {
  const vv = window.visualViewport
  if (!vv) return 0
  const gap = window.innerHeight - vv.height - Math.max(0, vv.offsetTop)
  return gap >= 48 ? Math.round(gap) : 0
}

/** Native resize shrinks the WKWebView — only lift the dock when layout viewport stays full height. */
function resolveNativeComposerInset() {
  const gap = readViewportKeyboardHeight()
  if (gap >= 48) return gap
  if (nativeHeight > 0) return 0
  return 0
}

function computeInset() {
  // On Capacitor, native plugin height is stable; viewport pan causes false spikes.
  if (Capacitor.isNativePlatform()) {
    if (nativeHeight > 0) return nativeHeight
    // Closing: viewport catches the tail of the animation.
    return viewportHeight
  }
  return Math.max(nativeHeight, viewportHeight)
}

function applyInset() {
  setAppKeyboardInset(computeInset())
  resetDocumentScroll()
}

function resetDocumentScroll() {
  window.scrollTo(0, 0)
  document.documentElement.scrollTop = 0
  document.body.scrollTop = 0
}
function scheduleApply() {
  if (rafId) return
  rafId = requestAnimationFrame(() => {
    rafId = 0
    viewportHeight = readViewportKeyboardHeight()
    applyInset()
  })
}

function parseKeyboardEventHeight(event) {
  if (typeof event?.keyboardHeight === 'number') return event.keyboardHeight
  if (typeof event?.detail?.keyboardHeight === 'number') return event.detail.keyboardHeight
  const raw = event?.detail
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw.replace(/'/g, '"'))
      if (typeof parsed?.keyboardHeight === 'number') return parsed.keyboardHeight
    } catch {
      /* ignore */
    }
  }
  return 0
}

function onKeyboardShow(height) {
  if (height > 0) nativeHeight = height
  if (Capacitor.isNativePlatform()) {
    setAppKeyboardInset(resolveNativeComposerInset())
    resetDocumentScroll()
  } else {
    scheduleApply()
  }
}

function onKeyboardHide() {
  nativeHeight = 0
  viewportHeight = 0
  if (Capacitor.isNativePlatform()) {
    setAppKeyboardInset(0)
  } else {
    scheduleApply()
  }
}

/**
 * Drive --app-keyboard-inset from the system keyboard.
 * ChatRoom lifts the composer via CSS (see .chat-room-keyboard-lift).
 */
export function setupKeyboardInset() {
  const vv = window.visualViewport

  const onViewportChange = () => {
    if (Capacitor.isNativePlatform()) {
      if (nativeHeight > 0) setAppKeyboardInset(resolveNativeComposerInset())
      return
    }
    scheduleApply()
  }

  const onWinShow = (event) => {
    const h = parseKeyboardEventHeight(event)
    onKeyboardShow(h)
  }
  const onWinHide = () => onKeyboardHide()

  vv?.addEventListener('resize', onViewportChange)
  vv?.addEventListener('scroll', onViewportChange)
  window.addEventListener('resize', onViewportChange)
  if (!Capacitor.isNativePlatform()) {
    window.addEventListener('keyboardWillShow', onWinShow)
    window.addEventListener('keyboardDidShow', onWinShow)
    window.addEventListener('keyboardWillHide', onWinHide)
    window.addEventListener('keyboardDidHide', onWinHide)
  }

  scheduleApply()
  void attachNativeKeyboardListeners()

  return () => {
    vv?.removeEventListener('resize', onViewportChange)
    vv?.removeEventListener('scroll', onViewportChange)
    window.removeEventListener('resize', onViewportChange)
    if (!Capacitor.isNativePlatform()) {
      window.removeEventListener('keyboardWillShow', onWinShow)
      window.removeEventListener('keyboardDidShow', onWinShow)
      window.removeEventListener('keyboardWillHide', onWinHide)
      window.removeEventListener('keyboardDidHide', onWinHide)
    }
    if (rafId) cancelAnimationFrame(rafId)
    if (pinRafId) cancelAnimationFrame(pinRafId)
    nativeHeight = 0
    viewportHeight = 0
    currentInset = 0
    document.documentElement.style.setProperty('--app-keyboard-inset', '0px')
    document.documentElement.style.setProperty('--chat-header-pin-y', '0px')
  }
}

/** Call after Cap bridge is ready (from setupNativeShell). */
export async function attachNativeKeyboardListeners() {
  if (!Capacitor.isNativePlatform() || nativeListenersReady) return
  nativeListenersReady = true

  try {
    // willShow alone — didShow often fires again with a different height and causes a snap.
    await Keyboard.addListener('keyboardWillShow', (info) => {
      onKeyboardShow(info?.keyboardHeight || 0)
    })
    await Keyboard.addListener('keyboardWillHide', () => {
      onKeyboardHide()
    })
  } catch {
    nativeListenersReady = false
  }
}

export function onAppKeyboardInset(handler) {
  const listener = (event) => handler(event.detail?.height || 0)
  window.addEventListener(KEYBOARD_INSET_EVENT, listener)
  handler(currentInset)
  return () => window.removeEventListener(KEYBOARD_INSET_EVENT, listener)
}

export function getAppKeyboardInset() {
  return currentInset
}

export { KEYBOARD_EASE, KEYBOARD_MS }

function isFocusableField(el) {
  if (!(el instanceof Element)) return false
  return el.matches(FOCUSABLE) || el.closest('[data-app-keyboard-field="true"]')
}

function getScrollParent(el) {
  let node = el?.parentElement
  while (node && node !== document.body && node !== document.documentElement) {
    const style = window.getComputedStyle(node)
    const overflowY = style.overflowY
    const canScroll =
      (overflowY === 'auto' || overflowY === 'scroll' || overflowY === 'overlay') &&
      node.scrollHeight > node.clientHeight + 1
    if (canScroll) return node
    node = node.parentElement
  }
  return document.scrollingElement || document.documentElement
}

export function scrollFieldAboveKeyboard(el, { behavior = 'smooth', extraPad = 24 } = {}) {
  if (!(el instanceof Element)) return
  if (el.closest('[data-chat-composer="true"]')) return

  const target = el.closest('[data-app-keyboard-field="true"]') || el
  const vv = window.visualViewport
  const visibleBottom = vv ? vv.offsetTop + vv.height : window.innerHeight
  const rect = target.getBoundingClientRect()
  const desiredBottom = visibleBottom - extraPad

  if (rect.bottom <= desiredBottom && rect.top >= (vv?.offsetTop || 0) + 12) {
    return
  }

  const delta = rect.bottom - desiredBottom
  const scroller = getScrollParent(target)

  if (scroller === document.scrollingElement || scroller === document.documentElement) {
    return
  }

  scroller.scrollBy({ top: delta, left: 0, behavior })
}

export function setupKeyboardFocusScroll() {
  // Native: Keyboard.setScroll({ isDisabled: true }) + fixed chat layers handle layout.
  if (Capacitor.isNativePlatform()) return () => {}

  let focused = null
  let frame = 0

  const schedule = (el, delay = 0) => {
    if (!el) return
    window.clearTimeout(frame)
    frame = window.setTimeout(() => scrollFieldAboveKeyboard(el), delay)
  }

  const onFocusIn = (e) => {
    const el = e.target
    if (!isFocusableField(el)) return
    if (el instanceof Element && el.closest('[data-chat-composer="true"]')) return
    focused = el instanceof Element ? el : null
    schedule(focused, 50)
    schedule(focused, 280)
  }

  const onFocusOut = () => {
    focused = null
  }

  const onViewportChange = () => {
    if (!focused || !document.contains(focused)) return
    schedule(focused, 16)
  }

  document.addEventListener('focusin', onFocusIn, true)
  document.addEventListener('focusout', onFocusOut, true)

  const vv = window.visualViewport
  vv?.addEventListener('resize', onViewportChange)
  vv?.addEventListener('scroll', onViewportChange)
  window.addEventListener('resize', onViewportChange)

  return () => {
    window.clearTimeout(frame)
    document.removeEventListener('focusin', onFocusIn, true)
    document.removeEventListener('focusout', onFocusOut, true)
    vv?.removeEventListener('resize', onViewportChange)
    vv?.removeEventListener('scroll', onViewportChange)
    window.removeEventListener('resize', onViewportChange)
  }
}
