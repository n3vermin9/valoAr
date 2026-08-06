import { resetDocumentScroll } from './keyboardFocus'

export function handleInputFocusCursor(event) {
  const { target } = event
  resetDocumentScroll()
  requestAnimationFrame(() => {
    if (document.activeElement !== target) return
    resetDocumentScroll()

    if (target.isContentEditable) {
      const selection = window.getSelection()
      if (!selection || selection.rangeCount === 0) return
      const range = selection.getRangeAt(0)
      if (!range.collapsed || range.startOffset !== 0) return
      focusInputAtEnd(target)
      return
    }

    const { value, selectionStart, selectionEnd } = target
    if (!value?.length) return
    if (selectionStart === 0 && selectionEnd === 0) {
      focusInputAtEnd(target)
    }
  })
}

export function createSanitizedChangeHandler(setValue, sanitize = (value) => value) {
  return (event) => {
    const { target } = event
    const value = target.value ?? ''
    const selectionStart = target.selectionStart ?? value.length
    const selectionEnd = target.selectionEnd ?? value.length
    const next = sanitize(value)
    const nextStart = sanitize(value.slice(0, selectionStart)).length
    const nextEnd = sanitize(value.slice(0, selectionEnd)).length
    setValue(next)

    if (target.isContentEditable) return

    requestAnimationFrame(() => {
      if (document.activeElement === target) {
        target.setSelectionRange(nextStart, nextEnd)
      }
    })
  }
}

export function focusInputAtEnd(element) {
  if (!element || element.disabled) return
  // preventScroll avoids WKWebView/iOS jumping the page when refocusing.
  element.focus({ preventScroll: true })

  if (element.isContentEditable) {
    const selection = window.getSelection()
    const range = document.createRange()
    range.selectNodeContents(element)
    range.collapse(false)
    selection?.removeAllRanges()
    selection?.addRange(range)
    return
  }

  const len = element.value?.length ?? 0
  element.setSelectionRange(len, len)
}

export function focusInputRefAtEnd(ref) {
  requestAnimationFrame(() => focusInputAtEnd(ref.current))
}
