const FOCUSABLE =
  'input:not([type="hidden"]):not([disabled]), textarea:not([disabled]), select:not([disabled]), [contenteditable="true"]'

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

/**
 * Scroll a field so it sits in the visible area above the keyboard.
 * Works for system keyboard (visualViewport) and in-app keyboard.
 */
export function scrollFieldAboveKeyboard(el, { behavior = 'smooth', extraPad = 24 } = {}) {
  if (!(el instanceof Element)) return

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
    window.scrollBy({ top: delta, left: 0, behavior })
  } else {
    scroller.scrollBy({ top: delta, left: 0, behavior })
  }

  // Fallback: center in nearest scrollport if still clipped.
  requestAnimationFrame(() => {
    const next = target.getBoundingClientRect()
    const bottom = vv ? vv.offsetTop + vv.height : window.innerHeight
    if (next.bottom > bottom - extraPad || next.top < (vv?.offsetTop || 0) + 12) {
      target.scrollIntoView({ block: 'center', behavior, inline: 'nearest' })
    }
  })
}

/** Keep the focused field visible when the iOS keyboard opens/resizes. */
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
    focused = el instanceof Element ? el : null
    // Wait for keyboard animation / visualViewport shrink.
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
