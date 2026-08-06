import { Capacitor } from '@capacitor/core'
import { Keyboard } from '@capacitor/keyboard'

const FOCUSABLE =
  'input:not([type="hidden"]):not([disabled]), textarea:not([disabled]), select:not([disabled]), [contenteditable="true"]'

const KEYBOARD_INSET_EVENT = 'app-keyboard-inset'
const NATIVE_KEYBOARD_EVENT = 'app-native-keyboard'
/** iOS keyboard animation: 250ms with a decelerating curve. */
const KEYBOARD_EASE = 'cubic-bezier(0.32, 0.72, 0, 1)'
const KEYBOARD_MS = 260
/** Below this the "gap" is an accessory bar / rounding noise, not a keyboard. */
const KEYBOARD_MIN_PX = 44

let currentInset = 0
let nativeHeight = 0
let rafId = 0
let nativeListenersReady = false
/**
 * While a screen owns the inset (chat room), it is the only writer. Prevents the
 * global viewport listener and the screen from fighting over the same variable.
 */
let insetOwners = 0

function setNativeHeight(px) {
  const next = Math.max(0, Math.round(px || 0))
  if (next === nativeHeight) return
  nativeHeight = next
  window.dispatchEvent(
    new CustomEvent(NATIVE_KEYBOARD_EVENT, { detail: { height: nativeHeight } })
  )
}

function setAppKeyboardInset(px) {
  const next = Math.max(0, Math.round(px || 0))
  if (next === currentInset) return
  currentInset = next
  document.documentElement.style.setProperty('--app-keyboard-inset', `${next}px`)
  window.dispatchEvent(new CustomEvent(KEYBOARD_INSET_EVENT, { detail: { height: next } }))
}

/**
 * How much of the layout viewport bottom the keyboard covers.
 *
 * Capacitor runs with `Keyboard.resize: 'none'` and scroll assist disabled, so the
 * layout viewport keeps full screen height and `position: fixed` stays anchored to
 * it. visualViewport reports the obscured area on most iOS versions; the plugin
 * height covers the ones where it does not. Taking the larger of the two keeps the
 * composer clear of the keys either way.
 *
 * `vv.offsetTop` is deliberately ignored: WKWebView reports it as the obscured
 * height even though nothing panned, so honouring it double counts the keyboard.
 */
export function measureKeyboardInset() {
  const root = document.documentElement
  const layoutHeight = root.clientHeight || window.innerHeight || 0
  const vv = window.visualViewport
  const covered = vv ? Math.round(layoutHeight - vv.height) : 0

  const raw = Math.max(nativeHeight, covered > KEYBOARD_MIN_PX ? covered : 0)
  if (raw <= KEYBOARD_MIN_PX) return 0
  // Never eat more than 3/4 of the screen, whatever a stale reading claims.
  return Math.min(raw, Math.round(layoutHeight * 0.75))
}

/** Take over writing --app-keyboard-inset (chat room). Returns a release fn. */
export function claimKeyboardInset() {
  insetOwners += 1
  let released = false
  return () => {
    if (released) return
    released = true
    insetOwners = Math.max(0, insetOwners - 1)
  }
}

/** Publish the inset from the current owner. */
export function publishKeyboardInset(px) {
  setAppKeyboardInset(px)
}

export function resetDocumentScroll() {
  if (window.scrollY !== 0 || window.scrollX !== 0) window.scrollTo(0, 0)
  document.documentElement.scrollTop = 0
  document.body.scrollTop = 0
}

function applyGlobalInset() {
  if (insetOwners > 0) return
  setAppKeyboardInset(measureKeyboardInset())
  resetDocumentScroll()
}

function scheduleGlobalInset() {
  if (rafId) return
  rafId = requestAnimationFrame(() => {
    rafId = 0
    applyGlobalInset()
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

/**
 * Drive --app-keyboard-inset from the system keyboard for screens that do not own
 * their own layout. The chat room claims ownership and computes it itself.
 */
export function setupKeyboardInset() {
  const vv = window.visualViewport

  const onViewportChange = () => scheduleGlobalInset()
  const onWinShow = (event) => {
    setNativeHeight(parseKeyboardEventHeight(event))
    applyGlobalInset()
  }
  const onWinHide = () => {
    setNativeHeight(0)
    applyGlobalInset()
  }

  vv?.addEventListener('resize', onViewportChange)
  vv?.addEventListener('scroll', onViewportChange)
  window.addEventListener('resize', onViewportChange)
  if (!Capacitor.isNativePlatform()) {
    window.addEventListener('keyboardWillShow', onWinShow)
    window.addEventListener('keyboardDidShow', onWinShow)
    window.addEventListener('keyboardWillHide', onWinHide)
    window.addEventListener('keyboardDidHide', onWinHide)
  }

  scheduleGlobalInset()
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
    rafId = 0
    setNativeHeight(0)
    currentInset = 0
    document.documentElement.style.setProperty('--app-keyboard-inset', '0px')
  }
}

/** Call after the Capacitor bridge is ready (from setupNativeShell). */
export async function attachNativeKeyboardListeners() {
  if (!Capacitor.isNativePlatform() || nativeListenersReady) return
  nativeListenersReady = true

  try {
    // willShow fires as the keyboard animation starts — layout in the same beat.
    await Keyboard.addListener('keyboardWillShow', (info) => {
      setNativeHeight(info?.keyboardHeight || 0)
      applyGlobalInset()
    })
    // didShow corrects height changes (predictive bar, hardware keyboard, language switch).
    await Keyboard.addListener('keyboardDidShow', (info) => {
      setNativeHeight(info?.keyboardHeight || 0)
      applyGlobalInset()
    })
    await Keyboard.addListener('keyboardWillHide', () => {
      setNativeHeight(0)
      applyGlobalInset()
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

/** Raw Capacitor keyboard height. */
export function getNativeKeyboardHeight() {
  return nativeHeight
}

export function onNativeKeyboardHeight(handler) {
  const listener = (event) => handler(event.detail?.height || 0)
  window.addEventListener(NATIVE_KEYBOARD_EVENT, listener)
  handler(nativeHeight)
  return () => window.removeEventListener(NATIVE_KEYBOARD_EVENT, listener)
}

/** Blur the focused field and hide the system keyboard. */
export async function dismissAppKeyboard() {
  const active = document.activeElement
  if (active instanceof HTMLElement) {
    if (active.closest?.('[data-chat-composer="true"]') || isFocusableField(active)) {
      active.blur()
    }
  }
  if (!Capacitor.isNativePlatform()) return
  try {
    await Keyboard.hide()
  } catch {
    /* plugin missing */
  }
}

export { KEYBOARD_EASE, KEYBOARD_MS, KEYBOARD_MIN_PX }

/** Text inputs only — not checkboxes, buttons, selects, file pickers. */
const TEXT_FIELD_SELECTOR = [
  'textarea:not([disabled])',
  'input:not([disabled]):not([type="hidden"]):not([type="button"]):not([type="submit"]):not([type="reset"]):not([type="checkbox"]):not([type="radio"]):not([type="file"]):not([type="range"]):not([type="color"]):not([type="image"])',
  '[contenteditable="true"]',
].join(',')

function isFocusableField(el) {
  if (!(el instanceof Element)) return false
  return el.matches(FOCUSABLE) || el.closest('[data-app-keyboard-field="true"]')
}

function isDisabledTextField(el) {
  if (!(el instanceof Element)) return true
  if (el.matches?.(':disabled') || el.disabled) return true
  if (el.readOnly) return true
  if (el.getAttribute('contenteditable') === 'false') return true
  if (el.getAttribute('aria-disabled') === 'true') return true
  return false
}

/**
 * Focus a text field without letting WKWebView pan the page to scroll-into-view.
 * Call from pointer handlers in the same user gesture so iOS still opens the keyboard.
 */
export function focusFieldWithoutScroll(el) {
  if (!(el instanceof HTMLElement) || isDisabledTextField(el)) return false
  resetDocumentScroll()
  try {
    el.focus({ preventScroll: true })
  } catch {
    el.focus()
  }
  resetDocumentScroll()
  return true
}

/**
 * Own every text-field tap so iOS/Capacitor does not jump the page on keyboard open.
 * Covers search bars, settings forms, modals, and any raw input/textarea.
 */
export function setupPreventScrollFieldFocus() {
  const resolveField = (target) => {
    if (!(target instanceof Element)) return null

    // Label → associated control (default activates without preventScroll).
    const label = target.closest('label')
    if (label) {
      const forId = label.htmlFor || label.getAttribute('for')
      const fromFor = forId ? document.getElementById(forId) : null
      const nested = label.querySelector(TEXT_FIELD_SELECTOR)
      const field = fromFor?.matches?.(TEXT_FIELD_SELECTOR) ? fromFor : nested
      if (field && !isDisabledTextField(field)) return field
      return null
    }

    // Leave nested controls alone (emoji, clear, send, password visibility, etc.).
    if (target.closest('button, a, summary, [role="button"]')) return null

    const field = target.closest(TEXT_FIELD_SELECTOR)
    if (!field || isDisabledTextField(field)) return null
    return field
  }

  const onPointerDown = (event) => {
    if (!event.isPrimary) return
    if (event.pointerType === 'mouse' && event.button !== 0) return

    const field = resolveField(event.target)
    if (!field) return

    // Already editing — allow normal caret placement; only kill residual page scroll.
    if (document.activeElement === field) {
      resetDocumentScroll()
      return
    }

    event.preventDefault()
    focusFieldWithoutScroll(field)
  }

  document.addEventListener('pointerdown', onPointerDown, { capture: true, passive: false })
  return () => {
    document.removeEventListener('pointerdown', onPointerDown, true)
  }
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
  // Story reply lifts via overlay keyboard inset — never scroll the canvas.
  if (el.closest('[data-story-viewer]') || el.closest('[data-story-reply-input]')) return

  const target = el.closest('[data-app-keyboard-field="true"]') || el
  const vv = window.visualViewport
  const visibleBottom = vv ? vv.offsetTop + vv.height : window.innerHeight
  const rect = target.getBoundingClientRect()
  const desiredBottom = visibleBottom - extraPad

  if (rect.bottom <= desiredBottom && rect.top >= (vv?.offsetTop || 0) + 12) return

  const scroller = getScrollParent(target)
  if (scroller === document.scrollingElement || scroller === document.documentElement) return

  scroller.scrollBy({ top: rect.bottom - desiredBottom, left: 0, behavior })
}

export function setupKeyboardFocusScroll() {
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
    // Always flatten residual document scroll (native focus pan / leftover).
    resetDocumentScroll()

    // Native: fixed layers + Keyboard.setScroll handle layout — no scroll-assist.
    if (Capacitor.isNativePlatform()) return

    if (el instanceof Element && el.closest('[data-chat-composer="true"]')) return
    if (el instanceof Element && (el.closest('[data-story-viewer]') || el.closest('[data-story-reply-input]'))) {
      return
    }
    focused = el instanceof Element ? el : null
    schedule(focused, 50)
    schedule(focused, 280)
  }

  const onFocusOut = () => {
    focused = null
  }

  const onViewportChange = () => {
    if (Capacitor.isNativePlatform()) return
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
